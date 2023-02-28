import { useLoader, useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { getWebcamTexture } from './lib/three/getWebcamTexture'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Controls } from './r3f/Controls'

const ThreeFiber = () => {
  const { gl, scene } = useThree()
  const video = document.createElement('video')
  const [loading, setLoading] = useState(true)

  window.addEventListener('resize', () => {
    gl.setPixelRatio(window.devicePixelRatio)
    gl.setSize(window.innerWidth, window.innerHeight)
  })

  useEffect(() => {
    const setWebCamTexture = async () => {
      scene.background = await getWebcamTexture(video)
      setLoading(false)
    }
    gl.setPixelRatio(window.devicePixelRatio)
    gl.setSize(window.innerWidth, window.innerHeight)
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
      <Controls isControl={true} />
      {gltf && (
        <primitive
          object={gltf.scene}
          scale={[10, 10, 10]}
          position={[0, -3, 0]}
        />
      )}
    </>
  )
}

export default ThreeFiber
