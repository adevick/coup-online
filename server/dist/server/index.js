"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = require("body-parser");
const cors_1 = __importDefault(require("cors"));
const gameState_1 = require("./utilities/gameState");
const identifiers_1 = require("./utilities/identifiers");
const game_1 = require("../shared/types/game");
const port = process.env.EXPRESS_PORT || 8000;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use((0, body_parser_1.json)());
const server = http_1.default.createServer(app);
app.get('/gameState', async (req, res) => {
    const roomId = req.query?.roomId;
    const playerId = req.query?.playerId;
    if (typeof roomId !== 'string' || typeof playerId !== 'string') {
        res.status(400).send('roomId and playerId are required');
        return;
    }
    const gameState = await (0, gameState_1.getPublicGameState)(roomId, playerId);
    if (!gameState) {
        res.status(404).send();
        return;
    }
    res.json(gameState);
});
app.post('/createGame', async (req, res) => {
    const playerId = req.body?.playerId;
    const playerName = req.body?.playerName;
    if (!playerId || !playerName) {
        res.status(400).send('playerId and playerName are required');
        return;
    }
    if (playerName.length > 10) {
        res.status(400).send('playerName must be 10 characters or less');
        return;
    }
    const roomId = (0, identifiers_1.generateRoomId)();
    await (0, gameState_1.createNewGame)(roomId);
    const newGameState = await (0, gameState_1.addPlayerToGame)(roomId, playerId, playerName);
    res.status(200).json(newGameState);
});
app.post('/resetGame', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    if (!roomId || !playerId) {
        res.status(400).send('roomId and playerId are required');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(404).send(`Room ${roomId} does not exist`);
        return;
    }
    const player = gameState.players.find(({ id }) => id === playerId);
    if (!player) {
        res.status(400).send('Player not in game');
        return;
    }
    if (gameState.players.filter(({ influences }) => influences.length).length > 1) {
        res.status(400).send('Current game is not over');
        return;
    }
    gameState = await (0, gameState_1.resetGame)(roomId);
    res.status(200).json(gameState);
});
app.post('/startGame', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    if (!roomId || !playerId) {
        res.status(400).send('roomId and playerId are required');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(404).send(`Room ${roomId} does not exist`);
        return;
    }
    const player = gameState.players.find(({ id }) => id === playerId);
    if (!player) {
        res.status(400).send('Player not in game');
        return;
    }
    if (!gameState.isStarted) {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            state.isStarted = true;
            state.turnPlayer = state.players[Math.floor(Math.random() * state.players.length)].name;
            (0, gameState_1.logEvent)(state, 'Game has started');
        });
    }
    res.status(200).json(gameState);
});
app.post('/joinGame', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    const playerName = req.body?.playerName?.trim();
    if (!roomId || !playerId || !playerName) {
        res.status(400).send('roomId, playerId, and playerName are required');
        return;
    }
    if (playerName.length > 10) {
        res.status(400).send('playerName must be 10 characters or less');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(404).send(`Room ${roomId} does not exist`);
        return;
    }
    const existingPlayer = gameState.players.find((player) => player.id === playerId);
    if (existingPlayer) {
        if (existingPlayer.name.toUpperCase() !== playerName.toUpperCase()) {
            res.status(400).send(`Previously joined Room ${roomId} as ${existingPlayer.name}`);
            return;
        }
    }
    else {
        if (gameState.players.length >= 6) {
            res.status(400).send(`Room ${roomId} is full`);
            return;
        }
        if (gameState.isStarted) {
            res.status(400).send(`Room ${roomId} is already playing`);
            return;
        }
        if (Object.values(game_1.Influences).some((influence) => influence.toUpperCase() === playerName.toUpperCase())) {
            res.status(400).send(`You may not choose the name of an influence`);
            return;
        }
        if (gameState.players.some((existingPlayer) => existingPlayer.name.toUpperCase() === playerName.toUpperCase())) {
            res.status(400).send(`Room ${roomId} already has player named ${playerName}`);
            return;
        }
        gameState = await (0, gameState_1.addPlayerToGame)(roomId, playerId, playerName);
    }
    res.status(200).json(gameState);
});
app.post('/action', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    const action = req.body?.action;
    const targetPlayer = req.body?.targetPlayer;
    if (!roomId || !playerId || !action) {
        res.status(400).send('roomId, playerId, and action are required');
        return;
    }
    if (!Object.values(game_1.Actions).includes(action)) {
        res.status(400).send('Unknown action');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(400).send(`Room ${roomId} does not exist`);
        return;
    }
    const player = gameState.players.find(({ id }) => id === playerId);
    if (!player) {
        res.status(400).send('Player not in game');
        return;
    }
    if (!player.influences.length) {
        res.status(400).send('You had your chance');
        return;
    }
    if (gameState.turnPlayer !== player.name
        || gameState.pendingAction
        || gameState.pendingActionChallenge
        || gameState.pendingBlock
        || gameState.pendingBlockChallenge) {
        res.status(400).send('You can\'t choose an action right now');
        return;
    }
    if ((game_1.ActionAttributes[action].coinsRequired ?? 0) > player.coins) {
        res.status(400).send('You don\'t have enough coins');
        return;
    }
    if (player.coins >= 10 && action !== game_1.Actions.Coup) {
        res.status(400).send('You must coup when you have 10 or more coins');
        return;
    }
    if (targetPlayer && !gameState.players.some((player) => player.name === targetPlayer)) {
        res.status(400).send('Unknown target player');
        return;
    }
    if (game_1.ActionAttributes[action].requiresTarget && !targetPlayer) {
        res.status(400).send('Target player is required for this action');
        return;
    }
    if (!game_1.ActionAttributes[action].requiresTarget && targetPlayer) {
        res.status(400).send('Target player is not allowed for this action');
        return;
    }
    if (!game_1.ActionAttributes[action].blockable && !game_1.ActionAttributes[action].challengeable) {
        if (action === game_1.Actions.Coup) {
            gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
                state.players.find(({ id }) => id === playerId).coins -= 7;
                (0, gameState_1.killPlayerInfluence)(state, targetPlayer);
                state.turnPlayer = (0, gameState_1.getNextPlayerTurn)(state);
                (0, gameState_1.logEvent)(state, `${player.name} used ${action} on ${targetPlayer}`);
            });
        }
        else if (action === game_1.Actions.Income) {
            gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
                state.players.find(({ id }) => id === playerId).coins += 1;
                state.turnPlayer = (0, gameState_1.getNextPlayerTurn)(state);
                (0, gameState_1.logEvent)(state, `${player.name} used ${action}`);
            });
        }
    }
    else {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            state.pendingAction = {
                action: action,
                pendingPlayers: state.players.reduce((agg, cur) => {
                    if (cur.influences.length && cur.name !== player.name) {
                        agg.push(cur.name);
                    }
                    return agg;
                }, []),
                targetPlayer
            };
            (0, gameState_1.logEvent)(state, `${player.name} is trying to use ${action}${targetPlayer ? ` on ${targetPlayer}` : ''}`);
        });
    }
    res.status(200).json(gameState);
});
app.post('/actionResponse', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    const response = req.body?.response;
    const claimedInfluence = req.body?.claimedInfluence;
    if (!roomId || !playerId || !response) {
        res.status(400).send('roomId, playerId, and response are required');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(400).send(`Room ${roomId} does not exist`);
        return;
    }
    const player = gameState.players.find(({ id }) => id === playerId);
    if (!player) {
        res.status(400).send('Player not in room');
        return;
    }
    if (!player.influences.length) {
        res.status(400).send('You had your chance');
        return;
    }
    if (!gameState.pendingAction
        || gameState.pendingActionChallenge
        || !gameState.pendingAction.pendingPlayers.includes(player.name)) {
        res.status(400).send('You can\'t choose an action response right now');
        return;
    }
    if (!Object.values(game_1.Responses).includes(response)) {
        res.status(400).send('Unknown response');
        return;
    }
    if (response === game_1.Responses.Pass) {
        if (gameState.pendingAction.pendingPlayers.length === 1) {
            gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
                (0, gameState_1.processPendingAction)(state);
                state.turnPlayer = (0, gameState_1.getNextPlayerTurn)(state);
            });
        }
        else {
            gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
                state.pendingAction.pendingPlayers.splice(state.pendingAction.pendingPlayers.findIndex((pendingPlayer) => pendingPlayer === player.name), 1);
            });
        }
    }
    else if (response === game_1.Responses.Challenge) {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            state.pendingAction.pendingPlayers = [];
            state.pendingActionChallenge = {
                sourcePlayer: player.name
            };
            (0, gameState_1.logEvent)(state, `${player.name} is challenging ${state.turnPlayer}`);
        });
    }
    else if (response === game_1.Responses.Block) {
        if (!claimedInfluence) {
            res.status(400).send('claimedInfluence is required when blocking');
            return;
        }
        if (!Object.values(game_1.Influences).includes(claimedInfluence)) {
            res.status(400).send('Unknown claimedInfluence');
            return;
        }
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            state.pendingAction.pendingPlayers = [];
            state.pendingBlock = {
                sourcePlayer: player.name,
                claimedInfluence
            };
            (0, gameState_1.logEvent)(state, `${player.name} is blocking ${state.turnPlayer} as ${claimedInfluence}`);
        });
    }
    res.status(200).json(gameState);
});
app.post('/actionChallengeResponse', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    const influence = req.body?.influence;
    if (!roomId || !playerId || !influence) {
        res.status(400).send('roomId, playerId, and influence are required');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(400).send(`Room ${roomId} does not exist`);
        return;
    }
    const player = gameState.players.find(({ id }) => id === playerId);
    if (!player) {
        res.status(400).send('Player not in room');
        return;
    }
    if (!player.influences.length) {
        res.status(400).send('You had your chance');
        return;
    }
    if (!gameState.pendingActionChallenge) {
        res.status(400).send('You can\'t choose a challenge response right now');
        return;
    }
    if (!Object.values(game_1.Influences).includes(influence)) {
        res.status(400).send('Unknown influence');
        return;
    }
    if (!player.influences.includes(influence)) {
        res.status(400).send('You don\'t have that influence');
        return;
    }
    if (game_1.InfluenceAttributes[influence].legalAction === gameState.pendingAction.action) {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            const actionPlayer = state.players.find(({ name }) => name === state.turnPlayer);
            const challengePlayer = state.players.find(({ name }) => name === state.pendingActionChallenge.sourcePlayer);
            (0, gameState_1.killPlayerInfluence)(state, challengePlayer.name);
            (0, gameState_1.logEvent)(state, `${challengePlayer.name} failed to challenge ${state.turnPlayer}`);
            actionPlayer.influences.splice(actionPlayer.influences.findIndex((i) => i === influence), 1);
            actionPlayer.influences.push((0, gameState_1.drawCardFromDeck)(state));
            delete state.pendingActionChallenge;
            (0, gameState_1.processPendingAction)(state);
            state.turnPlayer = (0, gameState_1.getNextPlayerTurn)(state);
        });
    }
    else {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            const actionPlayer = state.players.find(({ name }) => name === state.turnPlayer);
            const challengePlayer = state.players.find(({ name }) => name === state.pendingActionChallenge.sourcePlayer);
            (0, gameState_1.killPlayerInfluence)(state, actionPlayer.name);
            (0, gameState_1.logEvent)(state, `${challengePlayer.name} successfully challenged ${state.turnPlayer}`);
            state.turnPlayer = (0, gameState_1.getNextPlayerTurn)(state);
            delete state.pendingActionChallenge;
            delete state.pendingAction;
        });
    }
    res.status(200).json(gameState);
});
app.post('/blockResponse', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    const response = req.body?.response;
    if (!roomId || !playerId || !response) {
        res.status(400).send('roomId, playerId, and response are required');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(400).send(`Room ${roomId} does not exist`);
        return;
    }
    const player = gameState.players.find(({ id }) => id === playerId);
    if (!player) {
        res.status(400).send('Player not in room');
        return;
    }
    if (!player.influences.length) {
        res.status(400).send('You had your chance');
        return;
    }
    if (!gameState.pendingBlock) {
        res.status(400).send('You can\'t choose a block response right now');
        return;
    }
    if (!Object.values(game_1.Responses).includes(response)) {
        res.status(400).send('Unknown response');
        return;
    }
    if (response === game_1.Responses.Block) {
        res.status(400).send('You can\t block a block');
        return;
    }
    if (response === game_1.Responses.Challenge) {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            const blockPlayer = state.players.find(({ name }) => name === state.pendingBlock.sourcePlayer);
            (0, gameState_1.logEvent)(state, `${player.name} is challenging ${blockPlayer.name}`);
            state.pendingBlockChallenge = { sourcePlayer: player.name };
        });
    }
    else if (response === game_1.Responses.Pass) {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            const blockPlayer = state.players.find(({ name }) => name === state.pendingBlock.sourcePlayer);
            (0, gameState_1.logEvent)(state, `${blockPlayer.name} successfully blocked ${state.turnPlayer}`);
            state.turnPlayer = (0, gameState_1.getNextPlayerTurn)(state);
            delete state.pendingBlock;
            delete state.pendingActionChallenge;
            delete state.pendingAction;
        });
    }
    res.status(200).json(gameState);
});
app.post('/blockChallengeResponse', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    const influence = req.body?.influence;
    if (!roomId || !playerId || !influence) {
        res.status(400).send('roomId, playerId, and influence are required');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(400).send(`Room ${roomId} does not exist`);
        return;
    }
    const player = gameState.players.find(({ id }) => id === playerId);
    if (!player) {
        res.status(400).send('Player not in room');
        return;
    }
    if (!player.influences.length) {
        res.status(400).send('You had your chance');
        return;
    }
    if (!gameState.pendingBlockChallenge) {
        res.status(400).send('You can\'t choose a challenge response right now');
        return;
    }
    if (!Object.values(game_1.Influences).includes(influence)) {
        res.status(400).send('Unknown influence');
        return;
    }
    if (!player.influences.includes(influence)) {
        res.status(400).send('You don\'t have that influence');
        return;
    }
    if (game_1.InfluenceAttributes[influence].legalBlock === gameState.pendingAction.action) {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            const challengePlayer = state.players.find(({ name }) => name === state.pendingBlockChallenge.sourcePlayer);
            const blockPlayer = state.players.find(({ name }) => name === state.pendingBlock.sourcePlayer);
            (0, gameState_1.killPlayerInfluence)(state, challengePlayer.name);
            (0, gameState_1.logEvent)(state, `${blockPlayer.name} successfully blocked ${state.turnPlayer}`);
            state.turnPlayer = (0, gameState_1.getNextPlayerTurn)(state);
            delete state.pendingBlockChallenge;
            delete state.pendingBlock;
            delete state.pendingActionChallenge;
            delete state.pendingAction;
        });
    }
    else {
        gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
            const blockPlayer = state.players.find(({ name }) => name === state.pendingBlock.sourcePlayer);
            (0, gameState_1.killPlayerInfluence)(state, blockPlayer.name);
            (0, gameState_1.logEvent)(state, `${blockPlayer.name} failed to block ${state.turnPlayer}`);
            (0, gameState_1.processPendingAction)(state);
            state.turnPlayer = (0, gameState_1.getNextPlayerTurn)(state);
            delete state.pendingBlockChallenge;
            delete state.pendingBlock;
            delete state.pendingActionChallenge;
            delete state.pendingAction;
        });
    }
    res.status(200).json(gameState);
});
app.post('/loseInfluence', async (req, res) => {
    const roomId = req.body?.roomId;
    const playerId = req.body?.playerId;
    const influence = req.body?.influence;
    if (!roomId || !playerId || !influence) {
        res.status(400).send('roomId, playerId, and influence are required');
        return;
    }
    let gameState = await (0, gameState_1.getGameState)(roomId);
    if (!gameState) {
        res.status(400).send(`Room ${roomId} does not exist`);
        return;
    }
    const player = gameState.players.find(({ id }) => id === playerId);
    if (!player) {
        res.status(400).send('Player not in room');
        return;
    }
    if (!player.influences.length) {
        res.status(400).send('You had your chance');
        return;
    }
    if (!gameState.pendingInfluenceLoss[player.name]) {
        res.status(400).send('You can\'t lose influence right now');
        return;
    }
    if (!Object.values(game_1.Influences).includes(influence)) {
        res.status(400).send('Unknown influence');
        return;
    }
    gameState = await (0, gameState_1.mutateGameState)(roomId, (state) => {
        const sadPlayer = state.players.find(({ id }) => id === player.id);
        const removedInfluence = sadPlayer.influences.splice(sadPlayer.influences.findIndex((i) => i === influence), 1)[0];
        if (state.pendingInfluenceLoss[sadPlayer.name][0].putBackInDeck) {
            state.deck.unshift(removedInfluence);
        }
        if (state.pendingInfluenceLoss[sadPlayer.name].length > 1) {
            state.pendingInfluenceLoss[sadPlayer.name].splice(0, 1);
        }
        else {
            delete state.pendingInfluenceLoss[sadPlayer.name];
        }
        (0, gameState_1.logEvent)(state, `${player.name} lost their ${influence}`);
    });
    res.status(200).json(gameState);
});
server.listen(port, function () {
    console.log(`listening on ${port}`);
});
//# sourceMappingURL=index.js.map