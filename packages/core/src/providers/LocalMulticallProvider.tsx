import { ReactNode, useEffect, useState } from 'react'
import { getChainById } from '../helpers'
import { useEthers } from '../hooks'
import { useBlockNumber } from './blockNumber/blockNumber'
import { useConfig, useUpdateConfig } from './config'
import multicallABI from '../constants/abi/MultiCall.json'
import multicall2ABI from '../constants/abi/MultiCall2.json'
import { deployContract } from '../helpers/contract'

interface LocalMulticallProps {
  children: ReactNode
}

enum LocalMulticallState {
  Unknown,
  NonLocal,
  Deploying,
  Deployed,
  Error,
}

export function LocalMulticallProvider({ children }: LocalMulticallProps) {
  const updateConfig = useUpdateConfig()
  const { library, chainId } = useEthers()
  const { multicallAddresses, multicallVersion } = useConfig()
  const [localMulticallState, setLocalMulticallState] = useState(LocalMulticallState.Unknown)
  const [multicallBlockNumber, setMulticallBlockNumber] = useState<number>()
  const blockNumber = useBlockNumber()

  useEffect(() => {
    if (!library || !chainId) {
      setLocalMulticallState(LocalMulticallState.Unknown)
    } else if (!getChainById(chainId)?.isLocalChain) {
      setLocalMulticallState(LocalMulticallState.NonLocal)
    } else if (multicallAddresses && multicallAddresses[chainId]) {
      setLocalMulticallState(LocalMulticallState.Deployed)
    } else if (localMulticallState !== LocalMulticallState.Deploying) {
      const signer = library.getSigner()
      if (!signer) {
        setLocalMulticallState(LocalMulticallState.Error)
        return
      }

      setLocalMulticallState(LocalMulticallState.Deploying)

      const deployMulticall = async () => {
        try {
          const { contractAddress, blockNumber } = await deployContract(
            multicallVersion === 1 ? multicallABI : multicall2ABI,
            signer
          )
          updateConfig({ multicallAddresses: { [chainId]: contractAddress } })
          setMulticallBlockNumber(blockNumber)
          setLocalMulticallState(LocalMulticallState.Deployed)
        } catch {
          setLocalMulticallState(LocalMulticallState.Error)
        }
      }
      void deployMulticall()
    }
  }, [library, chainId])

  const awaitingMulticallBlock = multicallBlockNumber && blockNumber && blockNumber < multicallBlockNumber

  if (
    localMulticallState === LocalMulticallState.Deploying ||
    (localMulticallState === LocalMulticallState.Deployed && awaitingMulticallBlock)
  ) {
    return <div>Deploying multicall...</div>
  } else if (localMulticallState === LocalMulticallState.Error) {
    return <div>Error deploying multicall contract</div>
  } else {
    return <>{children}</>
  }
}
