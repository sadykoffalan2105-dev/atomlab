// atomlab_core — catalog composition match (WASM stub; full C++ in native/)
#include <cstdint>
#include <cstring>

extern "C" {

/** Returns number of matches written (stub: 0 until full port). */
int32_t catalog_match(const uint8_t* /*terms*/, int32_t /*terms_len*/, uint8_t* /*out*/, int32_t /*out_cap*/) {
  return 0;
}

}
