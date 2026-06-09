#include "rag_scan.h"

#include <ctype.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_CHUNKS 512
#define MAX_QUERY_TOKENS 96
#define MAX_TOKEN_LEN 64
#define MAX_NORM 16384
#define MAX_KW 2048

typedef struct {
    int id_hash;
    char norm_text[MAX_NORM];
    char keywords[MAX_KW];
} RagChunk;

static RagChunk g_chunks[MAX_CHUNKS];
static int g_chunk_count = 0;

static void to_lower_yo(char* dst, const char* src, size_t max) {
    size_t i = 0;
    for (; src[i] && i + 1 < max; i++) {
        unsigned char c = (unsigned char)src[i];
        if (c == 0xD1 && src[i + 1] == 0x91) { /* ё UTF-8 */
            dst[i++] = (char)0xD0;
            dst[i] = (char)0xB5;
            continue;
        }
        if (c == 0xD0 && src[i + 1] == 0x81) { /* Ё */
            dst[i++] = (char)0xD0;
            dst[i] = (char)0x95;
            continue;
        }
        dst[i] = (char)tolower(c);
    }
    dst[i] = '\0';
}

static int tokenize_query(const char* query, char tokens[][MAX_TOKEN_LEN], int max_tokens) {
    char norm[MAX_NORM];
    to_lower_yo(norm, query, sizeof(norm));
    int count = 0;
    char* p = norm;
    while (*p && count < max_tokens) {
        while (*p && !isalnum((unsigned char)*p)) p++;
        if (!*p) break;
        int len = 0;
        while (*p && isalnum((unsigned char)*p) && len < MAX_TOKEN_LEN - 1) {
            tokens[count][len++] = *p++;
        }
        tokens[count][len] = '\0';
        if (len >= 2) count++;
        else tokens[count][0] = '\0';
    }
    return count;
}

static int contains_token(const char* haystack, const char* token) {
    if (!token[0]) return 0;
    const char* p = haystack;
    while ((p = strstr(p, token)) != NULL) {
        return 1;
    }
    return 0;
}

RAG_EXPORT void rag_reset(void) {
    g_chunk_count = 0;
}

RAG_EXPORT int rag_add_chunk(int id_hash, const char* norm_text, const char* keywords) {
    if (g_chunk_count >= MAX_CHUNKS) return 0;
    RagChunk* c = &g_chunks[g_chunk_count++];
    c->id_hash = id_hash;
    strncpy(c->norm_text, norm_text ? norm_text : "", MAX_NORM - 1);
    c->norm_text[MAX_NORM - 1] = '\0';
    strncpy(c->keywords, keywords ? keywords : "", MAX_KW - 1);
    c->keywords[MAX_KW - 1] = '\0';
    return 1;
}

RAG_EXPORT int rag_top_k(const char* query, int k, int* out_ids, float* out_scores) {
    if (!query || !out_ids || !out_scores || k <= 0) return 0;

    char tokens[MAX_QUERY_TOKENS][MAX_TOKEN_LEN];
    int tcount = tokenize_query(query, tokens, MAX_QUERY_TOKENS);
    if (tcount == 0) return 0;

    int found = 0;
    for (int i = 0; i < g_chunk_count; i++) {
        float score = 0.f;
        RagChunk* c = &g_chunks[i];
        for (int t = 0; t < tcount; t++) {
            if (contains_token(c->norm_text, tokens[t])) score += 2.f;
            if (contains_token(c->keywords, tokens[t])) score += 3.f;
        }
        if (score <= 0.f) continue;

        int insert = found;
        for (int j = 0; j < found; j++) {
            if (score > out_scores[j]) {
                insert = j;
                break;
            }
        }
        if (found < k) found++;
        for (int j = found - 1; j > insert; j--) {
            out_ids[j] = out_ids[j - 1];
            out_scores[j] = out_scores[j - 1];
        }
        out_ids[insert] = c->id_hash;
        out_scores[insert] = score;
        if (found > k) found = k;
    }
    return found;
}
