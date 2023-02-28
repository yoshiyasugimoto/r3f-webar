import { createRoot } from 'react-dom/client'
import ReactApp from './ReactApp'
import { Canvas } from '@react-three/fiber'
import ThreeFiber from './r3f'

const root = document.querySelector('main')
if (!root) throw new Error('Three canvas is None.')

createRoot(root).render(
  <ReactApp>
    <Canvas>
      <ThreeFiber />
    </Canvas>
  </ReactApp>
)
