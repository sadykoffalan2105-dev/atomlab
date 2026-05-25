import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { ReactorTermsPreview } from './ReactorTermsPreview'

/**
 * @deprecated Используйте ReactorTermsPreview — превью по слагаемым (O₂ не удваивается).
 */
export function ReactorReagentRowPreview({ terms }: { terms: readonly ReactorEquationTerm[] }) {
  return <ReactorTermsPreview terms={terms} />
}
