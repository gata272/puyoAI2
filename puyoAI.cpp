#include <emscripten/emscripten.h>
#include <string>
#include <vector>
#include <map>
#include <algorithm>
#include <set>

struct Puyo { int main; int sub; };
struct Move { int col; int rot; bool valid = false; };

std::map<int, char> abstractColors(Puyo p1, Puyo p2, Puyo p3) {
    int charA_raw = p1.main;
    if (p1.main != p1.sub) {
        std::vector<int> p1Colors = {p1.main, p1.sub};
        std::vector<int> p2Colors = {p2.main, p2.sub};
        std::vector<int> intersect;
        for (int c : p1Colors) if (std::find(p2Colors.begin(), p2Colors.end(), c) != p2Colors.end()) intersect.push_back(c);
        if (intersect.size() == 1) charA_raw = intersect[0];
        else if (intersect.size() == 2) charA_raw = p1.main;
    }
    std::map<int, char> colorMap;
    colorMap[charA_raw] = 'A';
    std::vector<int> priorityColors = {p1.main, p1.sub, p2.main, p2.sub, p3.main, p3.sub};
    std::vector<int> uniqueColors; std::set<int> seen;
    for (int c : priorityColors) if (seen.find(c) == seen.end()) { uniqueColors.push_back(c); seen.insert(c); }
    char nextAlpha = 'B';
    for (int c : uniqueColors) if (c != charA_raw) colorMap[c] = nextAlpha++;
    return colorMap;
}

std::string getPattern(Puyo p, std::map<int, char>& cm) {
    std::vector<char> chars = {cm[p.main], cm[p.sub]};
    std::sort(chars.begin(), chars.end());
    std::string s = ""; s += chars[0]; s += chars[1];
    return s;
}

Move placeVertical(int col, char bottomTargetAlpha, Puyo p, std::map<int, char>& cm) {
    if (cm[p.main] == bottomTargetAlpha) return {col, 0, true};
    if (cm[p.sub] == bottomTargetAlpha) return {col, 2, true};
    return {col, 0, true};
}

Move placeHorizontal(int leftCol, int rightCol, char leftTargetAlpha, Puyo p, std::map<int, char>& cm) {
    if (leftTargetAlpha == '\0') return {leftCol, 1, true};
    if (cm[p.main] == leftTargetAlpha) return {leftCol, 1, true};
    if (cm[p.sub] == leftTargetAlpha) return {rightCol, 3, true};
    return {leftCol, 1, true};
}

Move getGTRMove(std::string patternKey, int turn, Puyo p, std::map<int, char>& cm) {
    // AAAA型
    if (patternKey == "AA-AA-AA") { if(turn==0) return placeVertical(2,'\0',p,cm); if(turn==1) return placeVertical(4,'\0',p,cm); if(turn==2) return placeVertical(3,'\0',p,cm); }
    if (patternKey == "AA-AA-AB") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(4,5,'\0',p,cm); if(turn==2) return placeVertical(3,'B',p,cm); }
    if (patternKey == "AA-AA-BB") { if(turn==0) return placeVertical(3,'\0',p,cm); if(turn==1) return placeVertical(3,'\0',p,cm); if(turn==2) return placeHorizontal(1,2,'\0',p,cm); }
    if (patternKey == "AA-AA-BC") { if(turn==0) return placeVertical(3,'\0',p,cm); if(turn==1) return placeVertical(3,'\0',p,cm); if(turn==2) return placeVertical(3,'B',p,cm); }

    // AAAB型
    if (patternKey == "AA-AB-AA") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeVertical(3,'B',p,cm); if(turn==2) return placeHorizontal(4,5,'\0',p,cm); }
    if (patternKey == "AA-AB-AB") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeVertical(3,'B',p,cm); if(turn==2) return placeVertical(4,'A',p,cm); }
    if (patternKey == "AA-AB-AC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeVertical(3,'B',p,cm); if(turn==2) return placeVertical(2,'C',p,cm); }
    if (patternKey == "AA-AB-BB") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeVertical(2,'B',p,cm); if(turn==2) return placeVertical(1,'B',p,cm); }
    if (patternKey == "AA-AB-BC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeVertical(3,'B',p,cm); if(turn==2) return placeVertical(4,'C',p,cm); }
    if (patternKey == "AA-AB-CC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeVertical(3,'B',p,cm); if(turn==2) return placeHorizontal(1,2,'\0',p,cm); }
    if (patternKey == "AA-AB-CD") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeVertical(3,'B',p,cm); if(turn==2) return placeVertical(6,'D',p,cm); }

    // ABAA型
    if (patternKey == "AB-AA-AA") { if(turn==0) return return placeVertical(3,'B',p,cm); if(turn==1) placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(4,5,'\0',p,cm); }
    if (patternKey == "AB-AA-AB") { if(turn==0) return placeVertical(3,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeVertical(4,'A',p,cm); }
    if (patternKey == "AB-AA-AC") { if(turn==0) return placeVertical(3,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeVertical(2,'C',p,cm); }
    if (patternKey == "AB-AA-BB") { if(turn==0) return placeVertical(2,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeVertical(1,'B',p,cm); }
    if (patternKey == "AB-AA-BC") { if(turn==0) return placeVertical(3,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeVertical(4,'C',p,cm); }
    if (patternKey == "AB-AA-CC") { if(turn==0) return placeVertical(3,'B',p,cm); return if(turn==1) placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(1,2,'\0',p,cm); }
    if (patternKey == "AB-AA-CD") { if(turn==0) return placeVertical(3,'B',p,cm); return if(turn==1) placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeVertical(6,'D',p,cm); }

    // AABB型
    if (patternKey == "AA-BB-AA") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(4,5,'\0',p,cm); }
    if (patternKey == "AA-BB-AB") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(1,2,'B',p,cm); }
    if (patternKey == "AA-BB-AC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeVertical(3,'C',p,cm); }
    if (patternKey == "AA-BB-BB") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(4,5,'\0',p,cm); }
    if (patternKey == "AA-BB-BC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeVertical(1,'B',p,cm); }
    if (patternKey == "AA-BB-CC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(4,5,'\0',p,cm); }
    if (patternKey == "AA-BB-CD") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(5,6,'C',p,cm); }

    // ABAB型
    if (patternKey == "AB-AB-AA") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeVertical(2,'A',p,cm); if(turn==2) return placeHorizontal(4,5,'\0',p,cm); }
    if (patternKey == "AB-AB-AB") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeVertical(2,'A',p,cm); if(turn==2) return placeHorizontal(1,2,'B',p,cm); }
    if (patternKey == "AB-AB-AC") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeVertical(2,'A',p,cm); if(turn==2) return placeVertical(3,'C',p,cm); }
    if (patternKey == "AB-AB-BB") { if(turn==0) return placeVertical(1,'B',p,cm); if(turn==1) return placeVertical(2,'B',p,cm); if(turn==2) return placeHorizontal(4,5,'\0',p,cm); }
    if (patternKey == "AB-AB-BC") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeVertical(2,'A',p,cm); if(turn==2) return placeVertical(1,'B',p,cm); }
    if (patternKey == "AB-AB-CC") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeVertical(2,'A',p,cm); if(turn==2) return placeHorizontal(4,5,'\0',p,cm); }
    if (patternKey == "AB-AB-CD") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeVertical(2,'A',p,cm); if(turn==2) return placeHorizontal(5,6,'\0',p,cm); }

    // ABAC型
    if (patternKey == "AB-AC-AA") { if(turn==0) return placeHorizontal(2,3,'A',p,cm); if(turn==1) return placeVertical(1,'A',p,cm); if(turn==2) return placeHorizontal(3,4,'\0',p,cm); }
    if (patternKey == "AB-AC-AB") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeHorizontal(2,3,'A',p,cm); if(turn==2) return placeHorizontal(2,3,'B',p,cm); }
    if (patternKey == "AB-AC-AC") { if(turn==0) return placeHorizontal(2,3,'A',p,cm); if(turn==1) return placeVertical(1,'A',p,cm); if(turn==2) return placeHorizontal(2,3,'C',p,cm); }
    if (patternKey == "AB-AC-AD") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeHorizontal(2,3,'A',p,cm); if(turn==2) return placeHorizontal(3,4,'A',p,cm); }
    if (patternKey == "AB-AC-BB") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeHorizontal(2,3,'A',p,cm); if(turn==2) return placeHorizontal(1,2,'\0',p,cm); }
    if (patternKey == "AB-AC-BC") { if(turn==0) return placeHorizontal(2,3,'A',p,cm); if(turn==1) return placeVertical(1,'A',p,cm); if(turn==2) return placeVertical(4,'B',p,cm); }
    if (patternKey == "AB-AC-BD") { if(turn==0) return placeHorizontal(2,3,'A',p,cm); if(turn==1) return placeVertical(1,'A',p,cm); if(turn==2) return placeVertical(4,'D',p,cm); }
    if (patternKey == "AB-AC-CC") { if(turn==0) return placeVertical(4,'B',p,cm); if(turn==1) return placeVertical(3,'A',p,cm); if(turn==2) return placeHorizontal(1,2,'\0',p,cm); }
    if (patternKey == "AB-AC-CD") { if(turn==0) return placeVertical(1,'A',p,cm); if(turn==1) return placeHorizontal(2,3,'A',p,cm); if(turn==2) return placeVertical(4,'C',p,cm); }

    // AABC型
    if (patternKey == "AA-BC-AA") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(3,2,'B',p,cm); if(turn==2) return placeHorizontal(2,3,'\0',p,cm); }
    if (patternKey == "AA-BC-AB") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(4,3,'B',p,cm); if(turn==2) return placeHorizontal(5,6,'B',p,cm); }
    if (patternKey == "AA-BC-AC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(4,3,'C',p,cm); if(turn==2) return placeHorizontal(5,6,'C',p,cm); }
    if (patternKey == "AA-BC-AD") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(3,4,'B',p,cm); if(turn==2) return placeHorizontal(2,3,'A',p,cm); }
    if (patternKey == "AA-BC-BB") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(4,3,'B',p,cm); if(turn==2) return placeHorizontal(5,6,'\0',p,cm); }
    if (patternKey == "AA-BC-BC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(4,3,'B',p,cm); if(turn==2) return placeVertical(5,'B',p,cm); }
    if (patternKey == "AA-BC-BD") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeVertical(1,'B',p,cm); if(turn==2) return placeHorizontal(2,3,'B',p,cm); }
    if (patternKey == "AA-BC-CC") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(2,3,'C',p,cm); if(turn==2) return placeVertical(1,'C',p,cm); }
    if (patternKey == "AA-BC-CD") { if(turn==0) return placeHorizontal(1,2,'\0',p,cm); if(turn==1) return placeHorizontal(4,3,'C',p,cm); if(turn==2) return placeHorizontal(5,6,'C',p,cm); }

    // ABCC型
    if (patternKey == "AB-CC-AA") { if(turn==0) return placeHorizontal(3,4,'A',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(5,6,'\0',p,cm); }
    if (patternKey == "AB-CC-AB") { if(turn==0) return placeVertical(4,'A',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeVertical(5,'A',p,cm); }
    if (patternKey == "AB-CC-AC") { if(turn==0) return placeHorizontal(3,4,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(3,4,'A',p,cm); }
    if (patternKey == "AB-CC-AD") { if(turn==0) return placeHorizontal(3,4,'A',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(5,6,'A',p,cm); }
    if (patternKey == "AB-CC-BB") { if(turn==0) return placeHorizontal(3,4,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(5,6,'\0',p,cm); }
    if (patternKey == "AB-CC-BC") { if(turn==0) return placeHorizontal(3,4,'A',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(3,4,'B',p,cm); }
    if (patternKey == "AB-CC-BD") { if(turn==0) return placeHorizontal(3,4,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(5,6,'B',p,cm); }
    if (patternKey == "AB-CC-CC") { if(turn==0) return placeHorizontal(3,4,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(5,6,'\0',p,cm); }
    if (patternKey == "AB-CC-CD") { if(turn==0) return placeHorizontal(3,4,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(2,3,'C',p,cm); }
    if (patternKey == "AB-CC-DD") { if(turn==0) return placeHorizontal(3,4,'B',p,cm); if(turn==1) return placeHorizontal(1,2,'\0',p,cm); if(turn==2) return placeHorizontal(1,2,'\0',p,cm); }

    return {0, 0, false};
}

static int turnCount = 0;
extern "C" {
EMSCRIPTEN_KEEPALIVE void reset_turn_count() { turnCount = 0; }
EMSCRIPTEN_KEEPALIVE int ai_choose_move_v2(int sub1, int main1, int sub2, int main2, int sub3, int main3) {
    if (turnCount >= 3) return -1;
    Puyo p1 = {main1, sub1}, p2 = {main2, sub2}, p3 = {main3, sub3};
    std::map<int, char> cm = abstractColors(p1, p2, p3);
    std::string patternKey = getPattern(p1, cm) + "-" + getPattern(p2, cm) + "-" + getPattern(p3, cm);
    Puyo currentPuyo = (turnCount == 0) ? p1 : (turnCount == 1 ? p2 : p3);
    Move m = getGTRMove(patternKey, turnCount, currentPuyo, cm);
    if (m.valid) { turnCount++; return (m.col - 1) * 10 + m.rot; }
    return -1;
}
EMSCRIPTEN_KEEPALIVE void set_board_cell(int index, int value) {}
}
