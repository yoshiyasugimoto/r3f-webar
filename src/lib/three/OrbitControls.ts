import * as Three from 'three'

const STATE = {
  NONE: -1,
  ROTATE: 0,
  DOLLY: 1,
  PAN: 2,
  TOUCH_ROTATE: 3,
  TOUCH_DOLLY: 4,
  TOUCH_PAN: 5,
}

const CHANGE_EVENT = { type: 'change' }
const START_EVENT = { type: 'start' }
const END_EVENT = { type: 'end' }
const EPS = 0.000001

export default class OrbitControls extends Three.EventDispatcher {
  object: Three.Camera | Three.Object3D
  domElement: HTMLElement | HTMLDocument
  window: Window

  // API
  enabled: boolean
  target: Three.Vector3

  enableZoom: boolean
  zoomSpeed: number
  minDistance: number
  maxDistance: number
  enableRotate: boolean
  rotateSpeed: number
  enablePan: boolean
  keyPanSpeed: number
  autoRotate: boolean
  autoRotateSpeed: number
  minZoom: number
  maxZoom: number
  minPolarAngle: number
  maxPolarAngle: number
  minAzimuthAngle: number
  maxAzimuthAngle: number
  enableKeys: boolean
  keys: { LEFT: number; UP: number; RIGHT: number; BOTTOM: number }
  mouseButtons: { ORBIT: Three.MOUSE; ZOOM: Three.MOUSE; PAN: Three.MOUSE }
  enableDamping: boolean
  dampingFactor: number
  reverseOrbit: boolean // true if you want to reverse the orbit to mouse drag from left to right = orbits left

  private spherical: Three.Spherical
  private sphericalDelta: Three.Spherical
  private scale: number
  private target0: Three.Vector3
  private position0: Three.Vector3
  private zoom0: any
  private state: number
  private panOffset: Three.Vector3
  private zoomChanged: boolean

  private rotateStart: Three.Vector2
  private rotateEnd: Three.Vector2
  private rotateDelta: Three.Vector2

  private panStart: Three.Vector2
  private panEnd: Three.Vector2
  private panDelta: Three.Vector2

  private dollyStart: Three.Vector2
  private dollyEnd: Three.Vector2
  private dollyDelta: Three.Vector2

  private updateLastPosition: Three.Vector3
  private updateOffset: Three.Vector3
  private updateQuat: Three.Quaternion
  private updateLastQuaternion: Three.Quaternion
  private updateQuatInverse: Three.Quaternion

  private panLeftV: Three.Vector3
  private panUpV: Three.Vector3
  private panInternalOffset: Three.Vector3

  private onContextMenu: EventListener
  private onMouseUp: EventListener
  private onMouseDown: EventListener
  private onMouseMove: EventListener
  private onMouseWheel: EventListener
  private onTouchStart: EventListener
  private onTouchEnd: EventListener
  private onTouchMove: EventListener
  private onKeyDown: EventListener

  constructor(
    object: Three.Camera | Three.Object3D,
    domElement?: HTMLElement,
    domWindow?: Window
  ) {
    super()
    this.object = object

    this.domElement = domElement !== undefined ? domElement : document
    this.window = domWindow !== undefined ? domWindow : window

    // Set to false to disable this control
    this.enabled = true

    // "target" sets the location of focus, where the object orbits around
    this.target = new Three.Vector3()

    // How far you can dolly in and out ( PerspectiveCamera only )
    this.minDistance = 0
    this.maxDistance = Infinity

    // How far you can zoom in and out ( OrthographicCamera only )
    this.minZoom = 0
    this.maxZoom = Infinity

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    this.minPolarAngle = 0 // radians
    this.maxPolarAngle = Math.PI // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    this.minAzimuthAngle = -Infinity // radians
    this.maxAzimuthAngle = Infinity // radians

    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    this.enableDamping = false
    this.dampingFactor = 0.25

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    this.enableZoom = true
    this.zoomSpeed = 1.0

    // Set to false to disable rotating
    this.enableRotate = true
    this.rotateSpeed = 1.0

    // Set to false to disable panning
    this.enablePan = true
    this.keyPanSpeed = 7.0 // pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    this.autoRotate = false
    this.autoRotateSpeed = 2.0 // 30 seconds per round when fps is 60

    // Set to false to disable use of the keys
    this.enableKeys = true

    // The four arrow keys
    this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 }

    // Mouse buttons
    this.mouseButtons = {
      ORBIT: Three.MOUSE.LEFT,
      ZOOM: Three.MOUSE.MIDDLE,
      PAN: Three.MOUSE.RIGHT,
    }

    // for reset
    this.target0 = this.target.clone()
    this.position0 = this.object.position.clone()
    this.zoom0 = (this.object as any).zoom

    // for update speedup
    this.updateOffset = new Three.Vector3()
    // so camera.up is the orbit axis
    this.updateQuat = new Three.Quaternion().setFromUnitVectors(
      object.up,
      new Three.Vector3(0, 1, 0)
    )
    this.updateQuatInverse = this.updateQuat.clone().invert()
    this.updateLastPosition = new Three.Vector3()
    this.updateLastQuaternion = new Three.Quaternion()

    this.state = STATE.NONE
    this.scale = 1

    // current position in spherical coordinates
    this.spherical = new Three.Spherical()
    this.sphericalDelta = new Three.Spherical()

    this.panOffset = new Three.Vector3()
    this.zoomChanged = false

    this.rotateStart = new Three.Vector2()
    this.rotateEnd = new Three.Vector2()
    this.rotateDelta = new Three.Vector2()

    this.panStart = new Three.Vector2()
    this.panEnd = new Three.Vector2()
    this.panDelta = new Three.Vector2()

    this.dollyStart = new Three.Vector2()
    this.dollyEnd = new Three.Vector2()
    this.dollyDelta = new Three.Vector2()

    this.panLeftV = new Three.Vector3()
    this.panUpV = new Three.Vector3()
    this.panInternalOffset = new Three.Vector3()

    // three.Object3D????????????????????????????????????(??????????????????????????????????????????????????????)
    this.reverseOrbit = false
    // event handlers - FSM: listen for events and reset state
    // @ts-ignore
    this.onMouseDown = (event: ThreeEvent) => {
      if (this.enabled === false) return
      event.preventDefault()
      if ((event as any).button === this.mouseButtons.ORBIT) {
        if (this.enableRotate === false) return
        this.rotateStart.set(event.clientX, event.clientY)
        this.state = STATE.ROTATE
      } else if (event.button === this.mouseButtons.ZOOM) {
        if (this.enableZoom === false) return
        this.dollyStart.set(event.clientX, event.clientY)
        this.state = STATE.DOLLY
      } else if (event.button === this.mouseButtons.PAN) {
        if (this.enablePan === false) return
        this.panStart.set(event.clientX, event.clientY)
        this.state = STATE.PAN
      }

      if (this.state !== STATE.NONE) {
        document.addEventListener('mousemove', this.onMouseMove, false)
        document.addEventListener('mouseup', this.onMouseUp, false)
        this.dispatchEvent(START_EVENT)
      }
    }
    // @ts-ignore
    this.onMouseMove = (event: ThreeEvent) => {
      if (this.enabled === false) return

      event.preventDefault()

      if (this.state === STATE.ROTATE) {
        if (this.enableRotate === false) return
        this.rotateEnd.set(event.clientX, event.clientY)
        this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart)
        const element =
          this.domElement === document ? this.domElement.body : this.domElement

        // rotating across whole screen goes 360 degrees around
        this.rotateLeft(
          ((2 * Math.PI * this.rotateDelta.x) / (element as any).clientWidth) *
            this.rotateSpeed
        )
        // rotating up and down along whole screen attempts to go 360, but limited to 180
        this.rotateUp(
          ((2 * Math.PI * this.rotateDelta.y) / (element as any).clientHeight) *
            this.rotateSpeed
        )
        this.rotateStart.copy(this.rotateEnd)

        this.update()
      } else if (this.state === STATE.DOLLY) {
        if (this.enableZoom === false) return

        this.dollyEnd.set(event.clientX, event.clientY)
        this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart)

        if (this.dollyDelta.y > 0) {
          this.dollyIn(this.getZoomScale())
        } else if (this.dollyDelta.y < 0) {
          this.dollyOut(this.getZoomScale())
        }

        this.dollyStart.copy(this.dollyEnd)
        this.update()
      } else if (this.state === STATE.PAN) {
        if (this.enablePan === false) return

        this.panEnd.set(event.clientX, event.clientY)
        this.panDelta.subVectors(this.panEnd, this.panStart)
        this.pan(this.panDelta.x, this.panDelta.y)
        this.panStart.copy(this.panEnd)
        this.update()
      }
    }
    // @ts-ignore
    this.onMouseUp = (event: ThreeEvent) => {
      if (this.enabled === false) return
      document.removeEventListener('mousemove', this.onMouseMove, false)
      document.removeEventListener('mouseup', this.onMouseUp, false)

      this.dispatchEvent(END_EVENT)
      this.state = STATE.NONE
    }
    // @ts-ignore
    this.onMouseWheel = (event: ThreeEvent) => {
      if (
        this.enabled === false ||
        this.enableZoom === false ||
        (this.state !== STATE.NONE && this.state !== STATE.ROTATE)
      )
        return

      event.preventDefault()
      event.stopPropagation()

      if (event.deltaY < 0) {
        this.dollyOut(this.getZoomScale())
      } else if (event.deltaY > 0) {
        this.dollyIn(this.getZoomScale())
      }

      this.update()

      this.dispatchEvent(START_EVENT) // not sure why these are here...
      this.dispatchEvent(END_EVENT)
    }
    // @ts-ignore
    this.onKeyDown = (event: ThreeEvent) => {
      if (
        this.enabled === false ||
        this.enableKeys === false ||
        this.enablePan === false
      )
        return

      switch (event.keyCode) {
        case this.keys.UP:
          {
            this.pan(0, this.keyPanSpeed)
            this.update()
          }
          break
        case this.keys.BOTTOM:
          {
            this.pan(0, -this.keyPanSpeed)
            this.update()
          }
          break
        case this.keys.LEFT:
          {
            this.pan(this.keyPanSpeed, 0)
            this.update()
          }
          break
        case this.keys.RIGHT:
          {
            this.pan(-this.keyPanSpeed, 0)
            this.update()
          }
          break
      }
    }
    // @ts-ignore
    this.onTouchStart = (event: ThreeEvent) => {
      if (this.enabled === false) return

      switch (event.touches.length) {
        // one-fingered touch: rotate
        case 1:
          {
            if (this.enableRotate === false) return

            this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY)
            this.state = STATE.TOUCH_ROTATE
          }
          break
        // two-fingered touch: dolly
        case 2:
          {
            if (this.enableZoom === false) return

            var dx = event.touches[0].pageX - event.touches[1].pageX
            var dy = event.touches[0].pageY - event.touches[1].pageY

            var distance = Math.sqrt(dx * dx + dy * dy)
            this.dollyStart.set(0, distance)
            this.state = STATE.TOUCH_DOLLY
          }
          break
        // three-fingered touch: pan
        case 3:
          {
            if (this.enablePan === false) return

            this.panStart.set(event.touches[0].pageX, event.touches[0].pageY)
            this.state = STATE.TOUCH_PAN
          }
          break
        default: {
          this.state = STATE.NONE
        }
      }

      if (this.state !== STATE.NONE) {
        this.dispatchEvent(START_EVENT)
      }
    }

    // @ts-ignore
    this.onTouchMove = (event: ThreeEvent) => {
      if (this.enabled === false) return
      event.preventDefault()
      event.stopPropagation()

      switch (event.touches.length) {
        // one-fingered touch: rotate
        case 1:
          {
            if (this.enableRotate === false) return
            if (this.state !== STATE.TOUCH_ROTATE) return // is this needed?...

            this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY)
            this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart)

            var element =
              this.domElement === document
                ? this.domElement.body
                : this.domElement

            // rotating across whole screen goes 360 degrees around
            this.rotateLeft(
              ((2 * Math.PI * this.rotateDelta.x) /
                (element as any).clientWidth) *
                this.rotateSpeed
            )

            // rotating up and down along whole screen attempts to go 360, but limited to 180
            this.rotateUp(
              ((2 * Math.PI * this.rotateDelta.y) /
                (element as any).clientHeight) *
                this.rotateSpeed
            )

            this.rotateStart.copy(this.rotateEnd)

            this.update()
          }
          break
        // two-fingered touch: dolly
        case 2:
          {
            if (this.enableZoom === false) return
            if (this.state !== STATE.TOUCH_DOLLY) return // is this needed?...

            //console.log( 'handleTouchMoveDolly' );
            var dx = event.touches[0].pageX - event.touches[1].pageX
            var dy = event.touches[0].pageY - event.touches[1].pageY

            var distance = Math.sqrt(dx * dx + dy * dy)

            this.dollyEnd.set(0, distance)

            this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart)

            if (this.dollyDelta.y > 0) {
              this.dollyOut(this.getZoomScale())
            } else if (this.dollyDelta.y < 0) {
              this.dollyIn(this.getZoomScale())
            }

            this.dollyStart.copy(this.dollyEnd)
            this.update()
          }
          break
        // three-fingered touch: pan
        case 3:
          {
            if (this.enablePan === false) return
            if (this.state !== STATE.TOUCH_PAN) return // is this needed?...
            this.panEnd.set(event.touches[0].pageX, event.touches[0].pageY)
            this.panDelta.subVectors(this.panEnd, this.panStart)
            this.pan(this.panDelta.x, this.panDelta.y)
            this.panStart.copy(this.panEnd)
            this.update()
          }
          break
        default: {
          this.state = STATE.NONE
        }
      }
    }

    this.onTouchEnd = (event: Event) => {
      if (this.enabled === false) return
      this.dispatchEvent(END_EVENT)
      this.state = STATE.NONE
    }

    this.onContextMenu = (event) => {
      event.preventDefault()
    }

    this.domElement.addEventListener('contextmenu', this.onContextMenu, false)

    this.domElement.addEventListener('mousedown', this.onMouseDown, false)
    this.domElement.addEventListener('wheel', this.onMouseWheel, false)

    this.domElement.addEventListener('touchstart', this.onTouchStart, false)
    this.domElement.addEventListener('touchend', this.onTouchEnd, false)
    this.domElement.addEventListener('touchmove', this.onTouchMove, false)

    this.window.addEventListener('keydown', this.onKeyDown, false)

    // force an update at start
    this.update()
  }

  update() {
    const position = this.object.position
    this.updateOffset.copy(position).sub(this.target)

    // rotate offset to "y-axis-is-up" space
    this.updateOffset.applyQuaternion(this.updateQuat)

    // angle from z-axis around y-axis
    this.spherical.setFromVector3(this.updateOffset)

    if (this.autoRotate && this.state === STATE.NONE) {
      this.rotateLeft(this.getAutoRotationAngle())
    }

    ;(this.spherical as any).theta += (this.sphericalDelta as any).theta
    ;(this.spherical as any).phi += (this.sphericalDelta as any).phi

    // restrict theta to be between desired limits
    ;(this.spherical as any as any).theta = Math.max(
      this.minAzimuthAngle,
      Math.min(this.maxAzimuthAngle, (this.spherical as any).theta)
    )

    // restrict phi to be between desired limits
    ;(this.spherical as any).phi = Math.max(
      this.minPolarAngle,
      Math.min(this.maxPolarAngle, (this.spherical as any).phi)
    )

    this.spherical.makeSafe()
    ;(this.spherical as any).radius *= this.scale

    // restrict radius to be between desired limits
    ;(this.spherical as any).radius = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, (this.spherical as any).radius)
    )

    // move target to panned location
    this.target.add(this.panOffset)

    this.updateOffset.setFromSpherical(this.spherical)

    // rotate offset back to "camera-up-vector-is-up" space
    this.updateOffset.applyQuaternion(this.updateQuatInverse)

    position.copy(this.target).add(this.updateOffset)

    this.object.lookAt(this.target)

    if (this.enableDamping === true) {
      ;(this.sphericalDelta as any).theta *= 1 - this.dampingFactor
      ;(this.sphericalDelta as any).phi *= 1 - this.dampingFactor
    } else {
      this.sphericalDelta.set(0, 0, 0)
    }

    this.scale = 1
    this.panOffset.set(0, 0, 0)

    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

    if (
      this.zoomChanged ||
      this.updateLastPosition.distanceToSquared(this.object.position) > EPS ||
      8 * (1 - this.updateLastQuaternion.dot(this.object.quaternion)) > EPS
    ) {
      this.dispatchEvent(CHANGE_EVENT)
      this.updateLastPosition.copy(this.object.position)
      this.updateLastQuaternion.copy(this.object.quaternion)
      this.zoomChanged = false
      return true
    }
    return false
  }

  panLeft(distance: number, objectMatrix: Three.Matrix4) {
    this.panLeftV.setFromMatrixColumn(objectMatrix, 0) // get X column of objectMatrix
    this.panLeftV.multiplyScalar(-distance)
    this.panOffset.add(this.panLeftV)
  }

  panUp(distance: number, objectMatrix: Three.Matrix4) {
    this.panUpV.setFromMatrixColumn(objectMatrix, 1) // get Y column of objectMatrix
    this.panUpV.multiplyScalar(distance)
    this.panOffset.add(this.panUpV)
  }

  // deltaX and deltaY are in pixels; right and down are positive
  pan(deltaX: number, deltaY: number) {
    const element =
      this.domElement === document ? this.domElement.body : this.domElement

    if (
      this._checkPerspectiveCamera(this.object) ||
      this._checkThreeObject3D(this.object)
    ) {
      // perspective
      const position = this.object.position
      this.panInternalOffset.copy(position).sub(this.target)
      var targetDistance = this.panInternalOffset.length()

      // half of the fov is center to top of screen
      if (this._checkPerspectiveCamera(this.object))
        targetDistance *= Math.tan(((this.object.fov / 2) * Math.PI) / 180.0)

      // we actually don't use screenWidth, since perspective camera is fixed to screen height
      this.panLeft(
        (2 * deltaX * targetDistance) / (element as any).clientHeight,
        this.object.matrix
      )
      this.panUp(
        (2 * deltaY * targetDistance) / (element as any).clientHeight,
        this.object.matrix
      )
    } else if (this._checkOrthographicCamera(this.object)) {
      // orthographic
      this.panLeft(
        (deltaX * (this.object.right - this.object.left)) /
          this.object.zoom /
          (element as any).clientWidth,
        this.object.matrix
      )
      this.panUp(
        (deltaY * (this.object.top - this.object.bottom)) /
          this.object.zoom /
          (element as any).clientHeight,
        this.object.matrix
      )
    } else {
      // camera neither orthographic nor perspective
      console.warn(
        'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.'
      )
      this.enablePan = false
    }
  }

  dollyIn(dollyScale: number) {
    if (
      this._checkPerspectiveCamera(this.object) ||
      this._checkThreeObject3D(this.object)
    ) {
      this.scale /= dollyScale
    } else if (this._checkOrthographicCamera(this.object)) {
      this.object.zoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.object.zoom * dollyScale)
      )
      this.object.updateProjectionMatrix()
      this.zoomChanged = true
    } else {
      console.warn(
        'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.'
      )
      this.enableZoom = false
    }
  }

  dollyOut(dollyScale: number) {
    if (
      this._checkPerspectiveCamera(this.object) ||
      this._checkThreeObject3D(this.object)
    ) {
      this.scale *= dollyScale
    } else if (this._checkOrthographicCamera(this.object)) {
      this.object.zoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.object.zoom / dollyScale)
      )
      this.object.updateProjectionMatrix()
      this.zoomChanged = true
    } else {
      console.warn(
        'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.'
      )
      this.enableZoom = false
    }
  }

  getAutoRotationAngle() {
    return ((2 * Math.PI) / 60 / 60) * this.autoRotateSpeed
  }

  getZoomScale() {
    return Math.pow(0.95, this.zoomSpeed)
  }

  rotateLeft(angle: number) {
    ;(this.sphericalDelta as any).theta -= angle
  }

  rotateUp(angle: number) {
    if (this.reverseOrbit) {
      this.sphericalDelta.phi += angle
    } else {
      this.sphericalDelta.phi -= angle
    }
  }

  getPolarAngle(): number {
    return (this.spherical as any).phi
  }

  getAzimuthalAngle(): number {
    return (this.spherical as any).theta
  }

  dispose(): void {
    this.domElement.removeEventListener(
      'contextmenu',
      this.onContextMenu,
      false
    )
    this.domElement.removeEventListener('mousedown', this.onMouseDown, false)
    this.domElement.removeEventListener('wheel', this.onMouseWheel, false)

    this.domElement.removeEventListener('touchstart', this.onTouchStart, false)
    this.domElement.removeEventListener('touchend', this.onTouchEnd, false)
    this.domElement.removeEventListener('touchmove', this.onTouchMove, false)

    document.removeEventListener('mousemove', this.onMouseMove, false)
    document.removeEventListener('mouseup', this.onMouseUp, false)

    this.window.removeEventListener('keydown', this.onKeyDown, false)
    //this.dispatchEvent( { type: 'dispose' } ); // should this be added here?
  }

  reset(): void {
    this.target.copy(this.target0)
    this.object.position.copy(this.position0)
    ;(this.object as any).zoom = this.zoom0
    ;(this.object as any).updateProjectionMatrix()
    this.dispatchEvent(CHANGE_EVENT)

    this.update()

    this.state = STATE.NONE
  }

  saveState(): void {
    this.target0.copy(this.target)
    this.position0.copy(this.object.position)
    // Check whether the camera has zoom property
    if (
      this._checkOrthographicCamera(this.object) ||
      this._checkPerspectiveCamera(this.object)
    ) {
      this.zoom0 = this.object.zoom
    }
  }

  // backward compatibility
  get center(): Three.Vector3 {
    console.warn('Three.OrbitControls: .center has been renamed to .target')
    return this.target
  }
  get noZoom(): boolean {
    console.warn(
      'Three.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.'
    )
    return !this.enableZoom
  }

  set noZoom(value: boolean) {
    console.warn(
      'Three.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.'
    )
    this.enableZoom = !value
  }

  /**
   * TS typeguard. Checks whether the provided camera is PerspectiveCamera.
   * If the check passes (returns true) the passed camera will have the type Three.PerspectiveCamera in the if branch where the check was performed.
   * @param camera Object to be checked.
   */
  private _checkPerspectiveCamera(
    camera: Three.Camera | Three.Object3D
  ): camera is Three.PerspectiveCamera {
    return (camera as Three.PerspectiveCamera).isPerspectiveCamera
  }
  /**
   * TS typeguard. Checks whether the provided camera is OrthographicCamera.
   * If the check passes (returns true) the passed camera will have the type Three.OrthographicCamera in the if branch where the check was performed.
   * @param camera Object to be checked.
   */
  private _checkOrthographicCamera(
    camera: Three.Camera | Three.Object3D
  ): camera is Three.OrthographicCamera {
    return (camera as Three.OrthographicCamera).isOrthographicCamera
  }

  // Three.Object3D??????????????????????????????????????????????????????
  private _checkThreeObject3D(
    camera: Three.Camera | Three.Object3D
  ): camera is Three.Object3D {
    return (camera as Three.Object3D).isObject3D
  }
}

interface ThreeEvent extends Event {
  clientX: number
  clientY: number
  deltaY: number
  button: Three.MOUSE
  touches: Array<any>
  keyCode: number
}
