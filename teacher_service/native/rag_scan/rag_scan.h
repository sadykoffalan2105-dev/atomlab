#ifndef RAG_SCAN_H
#define RAG_SCAN_H

#ifdef _WIN32
#define RAG_EXPORT __declspec(dllexport)
#else
#define RAG_EXPORT
#endif

#ifdef __cplusplus
extern "C" {
#endif

RAG_EXPORT void rag_reset(void);
RAG_EXPORT int rag_add_chunk(int id_hash, const char* norm_text, const char* keywords);
RAG_EXPORT int rag_top_k(const char* query, int k, int* out_ids, float* out_scores);

#ifdef __cplusplus
}
#endif

#endif
