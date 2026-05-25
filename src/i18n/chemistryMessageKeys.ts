import type { ReactorValidationErrorCode } from '../chemistry/reactorEquationBalance'
import type { ParseLeftSideErrorCode } from '../chemistry/reactionLeftSideParser'
import type { MessageKey } from './messagesRu'

const REACTOR_KEYS: Record<ReactorValidationErrorCode, MessageKey> = {
  NO_PRODUCT: 'errors.reactor.NO_PRODUCT',
  PRODUCT_COEFF_INVALID: 'errors.reactor.PRODUCT_COEFF_INVALID',
  NO_REAGENTS: 'errors.reactor.NO_REAGENTS',
  MAX_TERMS: 'errors.reactor.MAX_TERMS',
  TERM_COEFF_INVALID: 'errors.reactor.TERM_COEFF_INVALID',
  UNKNOWN_ELEMENT: 'errors.reactor.UNKNOWN_ELEMENT',
  TOO_FEW_ATOMS: 'errors.reactor.TOO_FEW_ATOMS',
  MAX_FLY_ATOMS: 'errors.reactor.MAX_FLY_ATOMS',
  LEFT_PARSE_FAIL: 'errors.reactor.LEFT_PARSE_FAIL',
  BALANCE_MISMATCH: 'errors.reactor.BALANCE_MISMATCH',
}

const PARSE_KEYS: Record<ParseLeftSideErrorCode, MessageKey> = {
  LEFT_EMPTY: 'errors.parse.LEFT_EMPTY',
  SEGMENT_PARSE_FAIL: 'errors.parse.SEGMENT_PARSE_FAIL',
  UNKNOWN_ELEMENT_SYMBOL: 'errors.parse.UNKNOWN_ELEMENT_SYMBOL',
  MIXED_DIATOMIC: 'errors.parse.MIXED_DIATOMIC',
  NO_ADDENDUMS: 'errors.parse.NO_ADDENDUMS',
}

export function reactorValidationMessageKey(code: ReactorValidationErrorCode): MessageKey {
  return REACTOR_KEYS[code]
}

export function parseLeftSideMessageKey(code: ParseLeftSideErrorCode): MessageKey {
  return PARSE_KEYS[code]
}
