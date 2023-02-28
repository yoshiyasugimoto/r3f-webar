import { useLoader, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
import Box from './r3f/Box'
import { getWebcamTexture } from './lib/three/getWebcamTexture'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const ThreeFiber = () => {
  const { gl, scene } = useThree()
  const video = document.createElement('video')
  const [loading, setLoading] = useState(true)

  window.addEventListener('resize', () => {
    gl.setPixelRatio(window.devicePixelRatio)
    gl.setSize(window.innerWidth, window.innerHeight)
  })

  useEffect(() => {
    gl.setPixelRatio(window.devicePixelRatio)
    gl.setSize(window.innerWidth, window.innerHeight)

    const setWebCamTexture = async () => {
      scene.background = await getWebcamTexture(video)
      setLoading(false)
    }
    setWebCamTexture()
  }, [])

  const gltf = useLoader(GLTFLoader, 'yakiniku.glb')

  return loading ? (
    <>loading...</>
  ) : (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <pointLight position={[-10, -10, -10]} />
      <Box position={[-1.2, 0, 0]} />
      {/* <Box position={[1.2, 0, 0]} /> */}
      <Suspense fallback={null}>
        <primitive object={gltf.scene} />
      </Suspense>
    </>
  )
}

export default ThreeFiber
