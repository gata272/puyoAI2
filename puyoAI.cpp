#include <emscripten/emscripten.h>
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <vector>
#include <map>

static constexpr int W = 6;
static constexpr int H = 14;
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

// --- Utilities ---
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
            for (int i : g) { erased.push_back(i); res.board[i] = EMPTY; }
        }
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

// --- Feature Extraction & Scoring (Simplified for brevity) ---
static Features extractFeatures(const Board& b) {
    Features f;
    // ... (Same as previous implementation)
    return f;
}

static double scoreBoardFeatures(const Features& f) {
    // ... (Same as previous implementation)
    return 0.0;
}

static double scoreTurnResult(const ResolvedBoard& res) {
    if (res.topout) return -5000000.0;
    // ... (Same as previous implementation)
    return 0.0;
}

// --- Color Normalization Logic ---
struct ColorMap {
    std::map<int, int> mapping;
    int nextId = 1; // 1=A, 2=B, 3=C, 4=D

    int get(int rawColor) {
        if (rawColor == EMPTY || rawColor == GARBAGE) return rawColor;
        if (mapping.find(rawColor) == mapping.end()) {
            mapping[rawColor] = nextId++;
        }
        return mapping[rawColor];
    }
};

static ColorMap normalizeColors(int m1, int s1, int m2, int s2) {
    ColorMap cm;
    // (i) 1st move same color
    if (m1 == s1) {
        cm.get(m1); // A = m1
        cm.get(m2); // B = m2 (if new)
        cm.get(s2); // C = s2 (if new)
    } 
    // (ii-a) Common color between 1st and 2nd move
    else {
        int common = -1;
        if (m1 == m2 || m1 == s2) common = m1;
        else if (s1 == m2 || s1 == s2) common = s1;

        if (common != -1) {
            // If 2 colors common, m1 is A
            if ((m1 == m2 && s1 == s2) || (m1 == s2 && s1 == m2)) common = m1;
            cm.get(common); // A = common
            cm.get(m1); // B = m1 (if new)
            cm.get(s1); // C = s1 (if new)
            cm.get(m2); // D = m2 (if new)
            cm.get(s2); // E = s2 (if new)
        }
        // (ii-b) No common color
        else {
            cm.get(m1); // A
            cm.get(s1); // B
            cm.get(m2); // C
            cm.get(s2); // D
        }
    }
    return cm;
}

// --- GTR Opening System ---
struct Move { int x, rot; };

static Move getGTROpening(const std::string& pattern, int turn) {
    // turn 0=1st, 1=2nd, 2=3rd
    if (pattern == "AAAB") {
        if (turn == 0) return {0, 1}; // 1,2 col horizontal
        if (turn == 1) return {2, 2}; // 3 col B bottom vertical
    }
    if (pattern == "AABB") {
        if (turn == 0) return {0, 1}; // 1,2 col horizontal
        if (turn == 1) return {0, 1}; // 1,2 col horizontal
    }
    if (pattern == "ABAB") {
        if (turn == 0) return {0, 2}; // 1 col A bottom vertical
        if (turn == 1) return {1, 2}; // 2 col B bottom vertical
    }
    return {-1, -1};
}

// --- AI Core ---
static int sharedBoard[N];
static int turnCount = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE
void set_board_cell(int index, int value) {
    if (index >= 0 && index < N) sharedBoard[index] = value;
}

EMSCRIPTEN_KEEPALIVE
void reset_turn_count() { turnCount = 0; }

EMSCRIPTEN_KEEPALIVE
int ai_choose_move_v2(int sub1, int main1, int sub2, int main2) {
    // 1. Normalize Colors
    ColorMap cm = normalizeColors(main1, sub1, main2, sub2);
    
    // 2. Identify Pattern (Simplified)
    std::string pattern = "ABCD";
    if (main1 == sub1) {
        if (main2 == main1 || sub2 == main1) pattern = "AAAB";
        else pattern = "AA BC";
    } else if (main1 == main2 && sub1 == sub2) pattern = "ABAB";
    else if (main1 != sub1 && main2 != sub1 && main1 != main2 && main1 != sub2) pattern = "AABB";

    // 3. GTR Opening Check
    if (turnCount < 2) {
        Move m = getGTROpening(pattern, turnCount);
        if (m.x != -1) {
            turnCount++;
            return m.x * 10 + m.rot;
        }
    }

    // 4. Normal AI Search
    Board b;
    for(int i=0; i<N; ++i) b[i] = sharedBoard[i];
    
    double bestScore = -std::numeric_limits<double>::infinity();
    int bestMove = 0;

    for (int x = 0; x < W; ++x) {
        for (int rot = 0; rot < 4; ++rot) {
            Board tb = b;
            int x1 = x, y1 = H - 1, x2 = x, y2 = H - 1;
            if (rot == 0) { x2 = x; y2 = H - 1; x1 = x; y1 = H - 2; }
            else if (rot == 1) { x1 = x; y1 = H - 1; x2 = x + 1; y2 = H - 1; }
            else if (rot == 2) { x1 = x; y1 = H - 1; x2 = x; y2 = H - 2; }
            else if (rot == 3) { x1 = x; y1 = H - 1; x2 = x - 1; y2 = H - 1; }

            if (x1 < 0 || x1 >= W || x2 < 0 || x2 >= W) continue;
            if (tb[idx(x1, H-1)] != EMPTY || tb[idx(x2, H-1)] != EMPTY) continue;

            tb[idx(x1, H-1)] = main1;
            tb[idx(x2, H-1)] = sub1;
            applyGravity(tb);

            ResolvedBoard res = simulate(tb);
            double score = scoreTurnResult(res);
            if (!res.topout) {
                Features f = extractFeatures(res.board);
                score += scoreBoardFeatures(f);
            }

            if (score > bestScore) {
                bestScore = score;
                bestMove = x * 10 + rot;
            }
        }
    }
    turnCount++;
    return bestMove;
}

}
