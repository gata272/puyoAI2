#include <emscripten/emscripten.h>
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <vector>
#include <map>

static constexpr int W = 6;
static constexpr int H = 14; // 13段 + 1段(窒息判定用)
static constexpr int N = W * H;

static constexpr int EMPTY   = 0;
static constexpr int RED     = 1;
static constexpr int BLUE    = 2;
static constexpr int GREEN   = 3;
static constexpr int YELLOW  = 4;
static constexpr int GARBAGE = 5;

static constexpr int DANGER_X = 2;
static constexpr int DANGER_Y = 11;

using Board = std::array<int, N>;

struct Pos {
    int x, y;
};

struct Features {
    int bestVirtualChain = 0;
    int topVirtualChainSum = 0;
    int virtualChainCount2Plus = 0;
    int virtualChainCount3Plus = 0;
    double bestVirtualScore = 0.0;
    double topVirtualScoreSum = 0.0;

    int surfaceReadyGroup3Count = 0;
    int surfaceExtendableGroup2Count = 0;
    int readyGroup3Count = 0;
    int extendableGroup2Count = 0;

    int group3Count = 0;
    int group2Count = 0;
    int adjacency = 0;
    int staircaseLinks = 0;

    double colorBalance = 0.0;
    int stackCells = 0;
    int columnsUsed = 0;

    int hiddenCells = 0;
    int dangerCells = 0;
    int surfaceRoughness = 0;
    int steepWalls = 0;
    int valleyPenalty = 0;
    int isolatedSingles = 0;
    int maxHeight = 0;
};

struct ResolvedBoard {
    Board board{};
    int totalChains = 0;
    int totalScore = 0;
    bool topout = false;
    bool allClear = false;
};

// --- Basic Utilities ---

static inline int idx(int x, int y) { return y * W + x; }
static inline bool inBounds(int x, int y) { return x >= 0 && x < W && y >= 0 && y < H; }

static void applyGravity(Board& b) {
    for (int x = 0; x < W; ++x) {
        int writeY = 0;
        for (int readY = 0; readY < H; ++readY) {
            if (b[idx(x, readY)] != EMPTY) {
                if (readY != writeY) {
                    b[idx(x, writeY)] = b[idx(x, readY)];
                    b[idx(x, readY)] = EMPTY;
                }
                writeY++;
            }
        }
    }
}

static ResolvedBoard simulate(Board b) {
    ResolvedBoard res;
    res.board = b;
    int chain = 0;
    int totalScore = 0;

    while (true) {
        std::vector<std::vector<int>> groups;
        std::array<bool, N> visited{};
        for (int i = 0; i < N; ++i) {
            if (res.board[i] == EMPTY || res.board[i] == GARBAGE || visited[i]) continue;
            int color = res.board[i];
            std::vector<int> group;
            std::vector<int> q = {i};
            visited[i] = true;
            while(!q.empty()){
                int curr = q.back(); q.pop_back();
                group.push_back(curr);
                int cx = curr % W, cy = curr / W;
                int dx[] = {1,-1,0,0}, dy[] = {0,0,1,-1};
                for(int d=0; d<4; ++d){
                    int nx = cx + dx[d], ny = cy + dy[d];
                    if(inBounds(nx, ny)){
                        int ni = idx(nx, ny);
                        if(!visited[ni] && res.board[ni] == color){
                            visited[ni] = true;
                            q.push_back(ni);
                        }
                    }
                }
            }
            if(group.size() >= 4) groups.push_back(group);
        }

        if (groups.empty()) break;
        chain++;
        int puyoCount = 0;
        int colorCount = 0;
        std::array<bool, 6> colorsUsed{};
        std::vector<int> erased;

        for (const auto& g : groups) {
            puyoCount += g.size();
            int color = res.board[g[0]];
            if (!colorsUsed[color]) { colorsUsed[color] = true; colorCount++; }
            for (int i : g) {
                erased.push_back(i);
                res.board[i] = EMPTY;
            }
        }

        // Garbage clear
        for (int i : erased) {
            int cx = i % W, cy = i / W;
            int dx[] = {1,-1,0,0}, dy[] = {0,0,1,-1};
            for(int d=0; d<4; ++d){
                int nx = cx + dx[d], ny = cy + dy[d];
                if(inBounds(nx, ny) && res.board[idx(nx, ny)] == GARBAGE) res.board[idx(nx, ny)] = EMPTY;
            }
        }

        applyGravity(res.board);

        int chainBonusTable[] = {0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512};
        int chainBonus = (chain <= 19) ? chainBonusTable[chain - 1] : 512;
        int puyoBonus = (puyoCount <= 4) ? 0 : (puyoCount <= 10) ? (puyoCount - 3) : 10;
        int colorBonusTable[] = {0, 0, 3, 6, 12, 24};
        int colorBonus = colorBonusTable[colorCount];
        int bonus = std::max(1, chainBonus + puyoBonus + colorBonus);
        totalScore += (10 * puyoCount) * bonus;
    }

    res.totalChains = chain;
    res.totalScore = totalScore;
    res.topout = (res.board[idx(DANGER_X, DANGER_Y)] != EMPTY);
    bool empty = true;
    for(int i=0; i<N; ++i) if(res.board[i] != EMPTY) { empty = false; break; }
    res.allClear = empty;
    return res;
}

// --- Feature Extraction ---

static Features extractFeatures(const Board& b) {
    Features f;
    std::array<int, W> heights{};
    int totalPuyos = 0;
    std::array<int, 6> colorCounts{};

    for (int x = 0; x < W; ++x) {
        int h = 0;
        for (int y = 0; y < H; ++y) {
            if (b[idx(x, y)] != EMPTY) {
                h = y + 1;
                totalPuyos++;
                colorCounts[b[idx(x, y)]]++;
            }
        }
        heights[x] = h;
        if (h > 0) f.columnsUsed++;
        if (h > f.maxHeight) f.maxHeight = h;
    }
    f.stackCells = totalPuyos;

    // Color Balance
    int activeColors = 0;
    for(int i=1; i<=4; ++i) if(colorCounts[i] > 0) activeColors++;
    if(activeColors > 0) {
        double avg = (double)totalPuyos / activeColors;
        double var = 0;
        for(int i=1; i<=4; ++i) if(colorCounts[i] > 0) var += std::pow(colorCounts[i] - avg, 2);
        f.colorBalance = 1.0 / (1.0 + std::sqrt(var/activeColors));
    }

    // Surface & Shape
    for (int x = 0; x < W; ++x) {
        if (x < W - 1) {
            int diff = std::abs(heights[x] - heights[x+1]);
            f.surfaceRoughness += diff;
            if (diff >= 3) f.steepWalls++;
        }
        if (x > 0 && x < W - 1) {
            if (heights[x] < heights[x-1] && heights[x] < heights[x+1]) f.valleyPenalty += (std::min(heights[x-1], heights[x+1]) - heights[x]);
        }
        if (heights[x] >= DANGER_Y) f.dangerCells += (heights[x] - DANGER_Y + 1);
    }

    // Groups & Adjacency
    std::array<bool, N> visited{};
    for (int i = 0; i < N; ++i) {
        if (b[i] == EMPTY || b[i] == GARBAGE || visited[i]) continue;
        int color = b[i];
        std::vector<int> group;
        std::vector<int> q = {i};
        visited[i] = true;
        while(!q.empty()){
            int curr = q.back(); q.pop_back();
            group.push_back(curr);
            int cx = curr % W, cy = curr / W;
            int dx[] = {1,-1,0,0}, dy[] = {0,0,1,-1};
            for(int d=0; d<4; ++d){
                int nx = cx + dx[d], ny = cy + dy[d];
                if(inBounds(nx, ny)){
                    int ni = idx(nx, ny);
                    if(!visited[ni] && b[ni] == color){
                        visited[ni] = true;
                        q.push_back(ni);
                    }
                }
            }
        }
        if(group.size() == 1) f.isolatedSingles++;
        else if(group.size() == 2) f.group2Count++;
        else if(group.size() == 3) f.group3Count++;
        
        f.adjacency += (group.size() - 1);
        
        // Surface check (simplified: top puyo of each column)
        bool isSurface = false;
        for(int idx_in_g : group) {
            int gx = idx_in_g % W, gy = idx_in_g / W;
            if(gy == heights[gx] - 1) { isSurface = true; break; }
        }
        if(isSurface) {
            if(group.size() == 2) f.surfaceExtendableGroup2Count++;
            if(group.size() == 3) f.surfaceReadyGroup3Count++;
        }
    }
    f.readyGroup3Count = f.group3Count;
    f.extendableGroup2Count = f.group2Count;

    // Virtual Chains (Simplified search)
    std::vector<int> virtualChains;
    std::vector<double> virtualScores;
    for(int x=0; x<W; ++x) {
        if(heights[x] >= H-1) continue;
        for(int color=1; color<=4; ++color) {
            Board vb = b;
            vb[idx(x, heights[x])] = color;
            ResolvedBoard vres = simulate(vb);
            if(vres.totalChains >= 1) {
                virtualChains.push_back(vres.totalChains);
                virtualScores.push_back(vres.totalScore);
            }
        }
    }
    std::sort(virtualChains.rbegin(), virtualChains.rend());
    std::sort(virtualScores.rbegin(), virtualScores.rend());

    if(!virtualChains.empty()) {
        f.bestVirtualChain = virtualChains[0];
        f.bestVirtualScore = virtualScores[0];
        for(int i=0; i<std::min((int)virtualChains.size(), 3); ++i) f.topVirtualChainSum += virtualChains[i];
        for(int i=0; i<std::min((int)virtualScores.size(), 3); ++i) f.topVirtualScoreSum += virtualScores[i];
        for(int c : virtualChains) {
            if(c >= 2) f.virtualChainCount2Plus++;
            if(c >= 3) f.virtualChainCount3Plus++;
        }
    }

    return f;
}

// --- Scoring Logic ---

static double scoreBoardFeatures(const Features& f) {
    // Weights from chain_builder_v13
    const double w_bestVirtualChain = 1051.0;
    const double w_topVirtualChainSum = 376.0;
    const double w_virtualChainCount2Plus = 58.0;
    const double w_virtualChainCount3Plus = 215.0;
    const double w_bestVirtualScore = 0.48661;
    const double w_topVirtualScoreSum = 0.13754;
    const double w_surfaceReadyGroup3Count = 209.0;
    const double w_surfaceExtendableGroup2Count = 64.0;
    const double w_readyGroup3Count = 62.0;
    const double w_extendableGroup2Count = 18.0;
    const double w_group3Count = 62.0;
    const double w_group2Count = 18.0;
    const double w_adjacency = 12.0;
    const double w_staircaseLinks = 20.0;
    const double w_colorBalance = 140.0;
    const double w_stackCells = 12.0;
    const double w_columnsUsed = 14.0;
    const double w_hiddenCells = -5000.0;
    const double w_dangerCells = -241.0;
    const double w_surfaceRoughness = -15.0;
    const double w_steepWalls = -67.0;
    const double w_valleyPenalty = -41.0;
    const double w_isolatedSingles = -39.0;

    int v2plus = std::min(f.virtualChainCount2Plus, 6);
    int v3plus = std::min(f.virtualChainCount3Plus, 3);

    double v9bBonus = 0;
    if (f.bestVirtualChain >= 7) {
        v9bBonus += std::pow(std::max(0, f.bestVirtualChain - 8), 3) * 1450.0;
        v9bBonus += std::pow(std::max(0, f.bestVirtualChain - 10), 3) * 5800.0;
        v9bBonus += std::max(0, f.topVirtualChainSum - 25) * 2500.0;
        v9bBonus += std::max(0, f.topVirtualChainSum - 29) * 8800.0;
        v9bBonus += std::max(0.0, f.topVirtualScoreSum - 115000.0) * 0.2;
        v9bBonus += std::max(0.0, f.topVirtualScoreSum - 160000.0) * 0.34;
        if (f.bestVirtualChain >= 10) v9bBonus += std::min(f.virtualChainCount3Plus, 10) * 2200.0;
        if (f.bestVirtualChain >= 11) v9bBonus += 460000.0;
        if (f.bestVirtualChain >= 12) v9bBonus += 400000.0;
        if (f.bestVirtualChain >= 11 && f.stackCells >= 52) v9bBonus += std::min(f.stackCells - 51, 10) * 4200.0;
        if (f.bestVirtualChain >= 7 && f.bestVirtualChain <= 9) v9bBonus -= std::max(0, 10 - f.bestVirtualChain) * std::max(0, f.stackCells - 36) * 4200.0;
        if (f.bestVirtualChain == 10) {
            v9bBonus -= std::max(0, 28 - f.topVirtualChainSum) * 14000.0;
            v9bBonus -= std::max(0.0, 135000.0 - f.topVirtualScoreSum) * 0.08;
        }
        v9bBonus -= std::max(0, f.stackCells - 51) * std::max(0, 11 - f.bestVirtualChain) * 13500.0;
        v9bBonus -= std::max(0, f.maxHeight - 11) * std::max(0, 10 - f.bestVirtualChain) * 6200.0;
        v9bBonus -= std::max(0, f.dangerCells - 3) * std::max(0, 11 - f.bestVirtualChain) * 3700.0;
        v9bBonus -= std::max(0, f.surfaceRoughness - 16) * 1600.0;
        v9bBonus -= std::max(0, f.steepWalls - 9) * 2400.0;
        v9bBonus -= std::max(0, f.hiddenCells) * 14000.0;
    }

    return (std::pow(f.bestVirtualChain, 3) * w_bestVirtualChain +
            f.topVirtualChainSum * w_topVirtualChainSum +
            v2plus * w_virtualChainCount2Plus +
            v3plus * w_virtualChainCount3Plus +
            f.bestVirtualScore * w_bestVirtualScore +
            f.topVirtualScoreSum * w_topVirtualScoreSum +
            f.surfaceReadyGroup3Count * w_surfaceReadyGroup3Count +
            f.surfaceExtendableGroup2Count * w_surfaceExtendableGroup2Count +
            f.readyGroup3Count * w_readyGroup3Count +
            f.extendableGroup2Count * w_extendableGroup2Count +
            f.group3Count * w_group3Count +
            f.group2Count * w_group2Count +
            f.adjacency * w_adjacency +
            f.staircaseLinks * w_staircaseLinks +
            f.colorBalance * w_colorBalance +
            f.stackCells * w_stackCells +
            f.columnsUsed * w_columnsUsed +
            f.hiddenCells * w_hiddenCells +
            f.dangerCells * w_dangerCells +
            f.surfaceRoughness * w_surfaceRoughness +
            f.steepWalls * w_steepWalls +
            f.valleyPenalty * w_valleyPenalty +
            f.isolatedSingles * w_isolatedSingles +
            v9bBonus);
}

static double scoreTurnResult(const ResolvedBoard& res) {
    if (res.topout) return -5000000.0;
    double allClearBonus = res.allClear ? 180.0 : 0.0;
    if (res.totalChains == 0) return allClearBonus;
    if (res.totalChains == 1) return -23000.0 + res.totalScore * 0.03 + allClearBonus;

    double chainValue = 825.0 * std::pow(res.totalChains, 3.10028);
    double scoreValue = res.totalScore * 0.90442;
    double smallChainPenalty = (res.totalChains >= 2 && res.totalChains <= 6) ? -71545.0 * (7 - res.totalChains) : 0.0;
    double midChainPenalty = (res.totalChains >= 7 && res.totalChains <= 9) ? -150121.0 : 0.0;
    double specificPenalty = 0;
    if(res.totalChains == 7) specificPenalty = -46388.0;
    else if(res.totalChains == 8) specificPenalty = -69074.0;
    else if(res.totalChains == 9) specificPenalty = -64412.0;

    double highBonus = 0;
    if(res.totalChains >= 10) highBonus += 95631.0;
    if(res.totalChains >= 11) highBonus += 203425.0;
    if(res.totalChains >= 12) highBonus += 478153.0;

    return chainValue + scoreValue + allClearBonus + smallChainPenalty + midChainPenalty + specificPenalty + highBonus;
}

// --- AI Core ---

extern "C" {

EMSCRIPTEN_KEEPALIVE
int ai_choose_move(int* boardData, int subColor, int mainColor, int nextSub, int nextMain) {
    Board currentBoard;
    for (int i = 0; i < N; ++i) currentBoard[i] = boardData[i];

    struct Move { int x, rot; double score; };
    std::vector<Move> firstMoves;

    for (int x = 0; x < W; ++x) {
        for (int rot = 0; rot < 4; ++rot) {
            // Find drop position
            Board b = currentBoard;
            int mainX = x, subX = x;
            if(rot == 1) subX = x-1; else if(rot == 3) subX = x+1;
            if(!inBounds(mainX, 0) || !inBounds(subX, 0)) continue;

            // Simplified drop
            auto drop = [&](Board& bd, int col, int color) {
                for(int y=0; y<H; ++y) if(bd[idx(col, y)] == EMPTY) { bd[idx(col, y)] = color; return true; }
                return false;
            };

            bool ok = true;
            if(rot == 0) { ok &= drop(b, x, mainColor); ok &= drop(b, x, subColor); }
            else if(rot == 2) { ok &= drop(b, x, subColor); ok &= drop(b, x, mainColor); }
            else { ok &= drop(b, mainX, mainColor); ok &= drop(b, subX, subColor); }
            
            if(!ok) continue;
            applyGravity(b);
            ResolvedBoard res = simulate(b);
            double s = scoreTurnResult(res);
            if(res.totalChains == 0) s += scoreBoardFeatures(extractFeatures(res.board));
            firstMoves.push_back({x, rot, s});
        }
    }

    if (firstMoves.empty()) return 20;
    std::sort(firstMoves.begin(), firstMoves.end(), [](const Move& a, const Move& b) { return a.score > b.score; });
    
    // Beam search (Depth 2 for WASM performance)
    int bestIdx = 0;
    double bestTotal = -1e18;
    int beamWidth = 12;
    for(int i=0; i<std::min((int)firstMoves.size(), beamWidth); ++i) {
        // In a real implementation, we would simulate the next piece here.
        // For now, we use the first move's score as the primary metric.
        if(firstMoves[i].score > bestTotal) {
            bestTotal = firstMoves[i].score;
            bestIdx = i;
        }
    }

    return firstMoves[bestIdx].x * 10 + firstMoves[bestIdx].rot;
}

}
