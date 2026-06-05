#ifndef ATOMLAB_CORE_H
#define ATOMLAB_CORE_H

#include <cstdint>

extern "C" {

/** Returns number of match records written (stub until full catalog ABI). */
int32_t catalog_match(const uint8_t* terms, int32_t terms_len, uint8_t* out, int32_t out_cap);

}

#endif
