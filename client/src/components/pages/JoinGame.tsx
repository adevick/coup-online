import { useState } from "react"
import { Box, Breadcrumbs, Button, Grid2, TextField, Typography } from "@mui/material"
import { AccountCircle, Group } from "@mui/icons-material"
import useSWRMutation from "swr/mutation"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { getPlayerId } from "../../helpers/playerId"
import { useWebSocketContext } from "../../contexts/WebSocketContext"
import { useGameStateContext } from "../../contexts/GameStateContext"
import { PublicGameState } from '@shared'

type JoinGameParams = { roomId: string, playerId: string, playerName: string }

const joinGameEvent = 'joinGame'

function JoinGame() {
  const [searchParams] = useSearchParams()
  const [roomId, setRoomId] = useState(searchParams.get('roomId') ?? '')
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState<string>()
  const navigate = useNavigate()
  const { socket } = useWebSocketContext()
  const { setGameState } = useGameStateContext()

  const updateGameStateAndNavigate = (gameState: PublicGameState) => {
    setGameState(gameState)
    navigate(`/game?roomId=${gameState.roomId}`)
  }

  const { trigger: triggerSwr, isMutating } = useSWRMutation(`${process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:8008'}/${joinGameEvent}`, (async (url: string, { arg }: { arg: JoinGameParams }) => {
    setError(undefined)
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(arg)
    }).then(async (res) => {
      if (res.ok) {
        const gameState = await res.json()
        updateGameStateAndNavigate(gameState)
      } else {
        if (res.status === 404) {
          setError('Room not found')
        } else if (res.status === 400) {
          setError(await res.text())
        } else {
          setError('Error joining game')
        }
      }
    })
  }))

  const trigger = socket?.connected
    ? (params: JoinGameParams) => {
      socket.removeAllListeners('gameStateChanged').on('gameStateChanged', (gameState) => {
        updateGameStateAndNavigate(gameState)
      })
      socket.removeAllListeners('error').on('error', (error) => { setError(error) })
      socket.emit(joinGameEvent, params)
    }
    : triggerSwr

  return (
    <>
      <Breadcrumbs sx={{ m: 2 }} aria-label="breadcrumb">
        <Link to='/'>Home</Link>
        <Typography>Join Game</Typography>
      </Breadcrumbs>
      <Typography variant="h5" sx={{ m: 5 }}>
        Join an Existing Game
      </Typography>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          trigger({
            roomId: roomId.trim(),
            playerId: getPlayerId(),
            playerName: playerName.trim()
          })
        }}>
        <Grid2 container direction="column" alignContent='center'>
          <Grid2>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Group sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
              <TextField
                value={roomId}
                onChange={(event) => {
                  setRoomId(event.target.value.slice(0, 6).toUpperCase())
                }}
                label="Room Id"
                variant="standard"
                required
              />
            </Box>
          </Grid2>
          <Grid2>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', mt: 3 }}>
              <AccountCircle sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
              <TextField
                value={playerName}
                onChange={(event) => {
                  setPlayerName(event.target.value.slice(0, 10))
                }}
                label="What is your name?"
                variant="standard"
                required
              />
            </Box>
          </Grid2>
        </Grid2>
        <Grid2>
          <Button
            type="submit" sx={{ mt: 5 }}
            variant="contained"
            disabled={isMutating}
          >Join Game</Button>
        </Grid2>
        {error && <Typography color='error' sx={{ mt: 3, fontWeight: 700 }}>{error}</Typography>}
      </form>
    </>
  )
}

export default JoinGame
