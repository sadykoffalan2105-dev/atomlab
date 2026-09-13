import { createRoot } from 'react-dom/client'
import { InstancedBondsDemo } from './InstancedBondsDemo'

const root = document.getElementById('root')
if (root) createRoot(root).render(<InstancedBondsDemo />)
