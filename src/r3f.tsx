import { useLoader, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useState } from 'react'
import { getWebcamTexture } from './lib/three/getWebcamTexture'
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { Controls } from './r3f/Controls'

const ThreeFiber = () => {
  const { gl, scene } = useThree()
  const video = document.createElement('video')
  const gltf = useLoader(GLTFLoader, 'yakiniku.glb')
  window.addEventListener('resize', () => {
    gl.setPixelRatio(window.devicePixelRatio)
    gl.setSize(window.innerWidth, window.innerHeight)
  })

  useLayoutEffect(() => {
    gl.setPixelRatio(window.devicePixelRatio)
    gl.setSize(window.innerWidth, window.innerHeight)

    const setWebCamTexture = async () => {
      scene.background = await getWebcamTexture(video)
    }
    setWebCamTexture()
  }, [gltf])

  return (
    <>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
      <pointLight position={[-10, -10, -10]} />
      <Controls isControl={true} />
      {gltf && (
        <primitive
          object={gltf.scene}
          scale={[10, 10, 10]}
          position={[0, -2, 0]}
          rotation={[Math.PI / 8, 0, 0]}
        />
      )}
    </>
  )
}

export default ThreeFiber
