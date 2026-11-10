// 矩阵分块（cache blocking）基准：朴素 ijk vs 各种块大小
// 编译：g++ -O2 -o bench_block.exe bench_block.cpp
// 用法：bench_block.exe            -> 默认跑 n = 256 512 1024
//       bench_block.exe 256 512    -> 只跑指定规模
#include <bits/stdc++.h>
using namespace std;
using Clock = std::chrono::steady_clock;

static const int MOD = 998244353;
static const int MAXN = 1100;
int n, S;
static int A[MAXN][MAXN], B[MAXN][MAXN], C[MAXN][MAXN];

void init() {
    memset(A, 0, sizeof(A));
    mt19937 rng(12345);
    for (int i = 0; i < n; ++i)
        for (int j = 0; j < n; ++j) {
            B[i][j] = rng() % 97 + 1;
            C[i][j] = rng() % 97 + 1;
        }
}

void reset() { memset(A, 0, sizeof(A)); }

long long checksum() {
    long long s = 0;
    for (int i = 0; i < n; i += 13) s += A[i][i];
    return s;
}

// 最朴素的三重循环
void naive_ijk() {
    for (int i = 0; i < n; ++i)
        for (int j = 0; j < n; ++j)
            for (int k = 0; k < n; ++k)
                A[i][j] = (A[i][j] + 1LL * B[i][k] * C[k][j]) % MOD;
}

// 分块写法：it -> jt -> kt -> i -> j -> k，块大小 S
void blocked() {
    for (int it = 0; it < n; it += S)
        for (int jt = 0; jt < n; jt += S)
            for (int kt = 0; kt < n; kt += S) {
                int ie = min(it + S, n), je = min(jt + S, n), ke = min(kt + S, n);
                for (int i = it; i < ie; ++i)
                    for (int j = jt; j < je; ++j)
                        for (int k = kt; k < ke; ++k)
                            A[i][j] = (A[i][j] + 1LL * B[i][k] * C[k][j]) % MOD;
            }
}

long long last_cs;

double bench(void (*fn)(), int reps) {
    double best = 1e30;
    long long cs = 0;
    for (int r = 0; r < reps; ++r) {
        reset();
        auto t0 = Clock::now();
        fn();
        double sec = std::chrono::duration<double>(Clock::now() - t0).count();
        best = min(best, sec);
        cs = checksum();
    }
    last_cs = cs;
    return best;
}

// res[n][S]：S=0 表示朴素基准
map<int, map<int, double>> res;
map<int, long long> base_cs;

int main(int argc, char **argv) {
    vector<int> Ns = {256, 512, 1024};
    if (argc > 1) {
        Ns.clear();
        for (int i = 1; i < argc; ++i) Ns.push_back(atoi(argv[i]));
    }
    for (int N : Ns) {
        if (N > MAXN) {
            fprintf(stderr, "n=%d 超过 MAXN=%d\n", N, MAXN);
            return 1;
        }
    }
    const vector<int> sizes = {1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 256};

    for (int N : Ns) {
        n = N;
        init();
        int reps = (N <= 256 ? 3 : (N <= 512 ? 2 : 1));

        double base = bench(naive_ijk, reps);
        res[N][0] = base;
        base_cs[N] = last_cs;
        fprintf(stderr, "n=%d 基准 %.3f s\n", N, base);

        for (int s : sizes) {
            S = s;
            double t = bench(blocked, reps);
            res[N][s] = t;
            if (last_cs != base_cs[N]) fprintf(stderr, "MISMATCH n=%d size=%d\n", N, s);
        }
        fprintf(stderr, "n=%d 完成\n", N);
    }

    auto cell = [&](int N, int key, bool is_base) {
        auto it = res[N].find(key);
        if (it == res[N].end()) return string("—");
        double t = it->second, b = res[N][0];
        char buf[80];
        if (is_base) snprintf(buf, sizeof buf, "%.3f s（基准）", t);
        else snprintf(buf, sizeof buf, "%.3f s（%.2f×）", t, b / t);
        return string(buf);
    };

    printf("| 配置 |");
    for (int N : Ns) printf(" n=%d |", N);
    printf("\n|---|");
    for (size_t i = 0; i < Ns.size(); ++i) printf("---|");
    printf("\n");

    printf("| 朴素 `ijk` |");
    for (int N : Ns) printf(" %s |", cell(N, 0, true).c_str());
    printf("\n");

    for (int s : sizes) {
        printf("| `size=%d` |", s);
        for (int N : Ns) printf(" %s |", cell(N, s, false).c_str());
        printf("\n");
    }
    return 0;
}

