import { Button, Grid2, Tooltip, Typography } from "@mui/material";
import { ActionAttributes, Actions, InfluenceAttributes, Influences, PublicGameState, ResponseAttributes, Responses } from "../../shared/types/game";
import useSWRMutation from "swr/mutation";
import { useState } from "react";
import { getPlayerId } from "../../helpers/playerId";

function ChooseInfluenceToLose({ roomId, gameState }: { roomId: string, gameState: PublicGameState }) {
  const [error, setError] = useState<string>();

  const { trigger, isMutating, error: swrError } = useSWRMutation(`${process.env.REACT_API_BASE_URL ?? 'http://localhost:8000'}/loseInfluence`, (async (url: string, { arg }: { arg: { roomId: string, playerId: string; influence: Influences }; }) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(arg)
    }).then(async (res) => {
      if (!res.ok) {
        setError('Error losing influence');
      }
    })
  }))

  return (
    <>
      <Typography sx={{ my: 1, fontWeight: 'bold', fontSize: '24px' }}>
        Choose an Influence to Lose:
      </Typography>
      <Grid2 container spacing={2} justifyContent="center">
        {gameState.selfPlayer.influences.map((influence, index) => {
          return <Button
            key={index}
            onClick={() => {
              trigger({
                roomId,
                playerId: getPlayerId(),
                influence: influence as Influences
              })
            }}
            sx={{
              background: InfluenceAttributes[influence].color
            }} variant="contained"
          >
            {influence}
          </Button>
        })}
      </Grid2>
      {error && <Typography sx={{ mt: 3, fontWeight: 700, color: 'red' }}>{error}</Typography>}
    </>
  );
}

export default ChooseInfluenceToLose;
