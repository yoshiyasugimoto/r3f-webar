import { FC, useReducer } from 'react'
import { Typography } from '@mui/material'
import ExplainCard from './components/ExplainCard'
import CenteringFullScreenDialog from './components/CenteringFullScreenDialog'

interface Props {
  children: React.ReactNode
}

export interface State {
  showWelcomeWindow: boolean
  screenshotModal: boolean
  startThreeFiber: boolean
}

export interface Action {
  type: 'setWelcomeWindow' | 'startThreeFiber'
  args?: any
}

function reducer(state: State, { type, args }: Action): State {
  switch (type) {
    case 'setWelcomeWindow':
      return { ...state, showWelcomeWindow: args }
    case 'startThreeFiber':
      return { ...state, startThreeFiber: args }
    default:
      return state
  }
}

const ReactApp: FC<Props> = ({ children }) => {
  // useState だと ThreeApp 側から状態を変更させるために setter を大量に渡さなければいけないが、
  // useReducer であれば dispatch だけを渡せばよいので、このアプリでは useReducer で状態を管理する
  const [state, dispach] = useReducer(reducer, {
    showWelcomeWindow: true,
    screenshotModal: false,
    startThreeFiber: false,
  })

  return (
    <>
      {/* 最初に表示するモーダル */}
      <CenteringFullScreenDialog open={state.showWelcomeWindow}>
        <ExplainCard
          onClick={() => {
            dispach({ type: 'setWelcomeWindow', args: false })
            dispach({ type: 'startThreeFiber', args: true })
          }}
          buttonText={'続ける'}
        >
          <Typography color="text.secondary">
            このコンテンツをお楽しみいただくには、位置情報やカメラなどへのアクセスを許可いただく必要があります。
          </Typography>
        </ExplainCard>
      </CenteringFullScreenDialog>

      {/* Canvas */}
      {state.startThreeFiber && children}
    </>
  )
}

export default ReactApp
