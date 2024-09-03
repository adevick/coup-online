import { Box, Button, Grid2, Tooltip, Typography } from "@mui/material";
import { ActionAttributes, Actions, PublicGameState } from "../../shared/types/game";
import useSWRMutation from "swr/mutation";
import { useState } from "react";
import { getPlayerId } from "../../helpers/playerId";

function ChooseAction({ roomId, gameState }: { roomId: string, gameState: PublicGameState }) {
  const [selectedAction, setSelectedAction] = useState<Actions>();
  const [error, setError] = useState<string>();

  const { trigger, isMutating, error: swrError } = useSWRMutation(`${process.env.REACT_API_BASE_URL ?? 'http://localhost:8000'}/action`, (async (
    url: string, { arg }: {
      arg: {
        roomId: string,
        playerId: string;
        action: Actions,
        targetPlayer?: string
      };
    }) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(arg)
    }).then(async (res) => {
      if (!res.ok) {
        if (res.status === 400) {
          setError(await res.text());
        } else {
          setError('Error choosing action');
        }
      }
    })
  }))

  return (
    <>
      {selectedAction ? (
        <>
          <Typography sx={{ my: 1, fontWeight: 'bold', fontSize: '24px' }}>
            Choose a Target:
          </Typography>
          <Grid2 container spacing={2} justifyContent="center">
            {gameState.players.map((player) => {
              if (player.name === gameState.selfPlayer.name || !player.influenceCount
              ) {
                return null;
              }
              return <Button onClick={() => {
                trigger({
                  roomId,
                  playerId: getPlayerId(),
                  action: selectedAction,
                  targetPlayer: player.name
                })
              }} color="inherit" sx={{ background: player.color }} key={player.name}>{player.name}</Button>
            })}
          </Grid2>
        </>
      ) : (
        <>
          <Typography sx={{ my: 1, fontWeight: 'bold', fontSize: '24px' }}>
            Choose an Action:
          </Typography>
          <Grid2 container spacing={2}>
            {Object.entries(ActionAttributes)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([action, actionAttributes], index) => {
                const isDisabled = !!actionAttributes.coinsRequired && gameState.selfPlayer.coins < actionAttributes.coinsRequired;

                return (
                  <Grid2 key={index}>
                    {isDisabled ? (
                      <Tooltip title="Not enough coins">
                        <span>
                          <Button
                            variant="contained"
                            disabled
                          >
                            {action}
                          </Button>
                        </span>
                      </Tooltip>
                    ) : (
                      <Button
                        onClick={() => {
                          if (!actionAttributes.requiresTarget) {
                            trigger({
                              roomId,
                              playerId: getPlayerId(),
                              action: action as Actions
                            })
                          } else {
                            setSelectedAction(action as Actions);
                          }
                        }}
                        sx={{
                          background: actionAttributes.color
                        }} variant="contained" >
                        {action}
                      </Button>
                    )}
                  </Grid2>
                );
              })}
          </Grid2>
        </>
      )}
      {error && <Typography sx={{ mt: 3, fontWeight: 700, color: 'red' }}>{error}</Typography>}
    </>
  );
}

export default ChooseAction;