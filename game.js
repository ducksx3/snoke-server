var { GRID_SIZE } = require('./constants');
const { randomColour } = require('./utils');

module.exports = {
  initGame,
  gameLoop,
  getUpdatedVelocity,
  createPlayer,
  updateGameRules,
}

function initGame(gameRules) {
  const state = createGameState(gameRules)
  randomFood(state);
  return state;
}

function createGameState(gameRules) {
  gameState = {    
    gameID: null,
    GameRules: {
      FPS: (gameRules.FPS && gameRules.FPS <= 30) ? gameRules.FPS : 10,
      snokesCollide: gameRules.snokesCollide ?? true,
      wallCollision: gameRules.wallCollision ?? false,
      eatSelf: gameRules.eatSelf ?? true,
      allowReversing: gameRules.allowReversing ?? false,
      cornerDrops: gameRules.cornerDrops ?? true,
      wallWrap: gameRules.wallWrap ?? true,
    },
    status: 'active',
    playerArray: [],
    players: [],
    food: {},
    gridsize: GRID_SIZE,
  };
  return gameState;
}

function gameLoop(state) {
  if (!state) {
    return;
  }

  // handle players
  for (i in state.players) {
      let player = state.players[i]; 
      player.pos.x += player.vel.x;
      player.pos.y += player.vel.y;



      for (let i = 0; i < player.inputStack.length; i++){
        getUpdatedVelocity(state, player, player.inputStack[i]);
        player.inputStack.splice(i, 1);
      }


      if(player.lastScore != player.score)
        player.lastScore = player.score;


      // if snake hits a wall
      if(state.GameRules.wallCollision) {
          if ( player.pos.x < 0 ||  player.pos.x > state.gridsize ||  player.pos.y < 0 ||  player.pos.y > state.gridsize) {
            resetPlayer(state, player)
          }
      }

      if(state.GameRules.wallWrap){
        if ( player.pos.x < 0) {
          player.pos.x = state.gridsize-1;
        }
        if ( player.pos.x >= state.gridsize) {
          player.pos.x = 0
        }
        if ( player.pos.y < 0) {
          player.pos.y = state.gridsize-1;
        }
        if ( player.pos.y >= state.gridsize){
          player.pos.y = 0;
        }
      }

      // if snake eats food
      if (state.food.x === player.pos.x && state.food.y === player.pos.y) {
          player.snake.push({ ...player.pos });
          player.pos.x += player.vel.x;
          player.pos.y += player.vel.y;
          player.score +=1;
          //state.gridsize = Math.floor(Math.random() * 50) + 5;
          randomFood(state);
        }


      // ##TODO - look into merging snakeCollision check into this one
      // if snake hits itself
      if (player.vel.x || player.vel.y) {
        for (let cell of player.snake){
          if(state.GameRules.eatSelf) {
            if (cell.x == player.pos.x && cell.y == player.pos.y ) {
              resetPlayer(state, player)
              console.log(`player ${player.number} ate themselves!`);
            }
          }
        }
        // ##TODO - possibly look into merging eatSelf and snokesCollide into one loop check

        // if snake hits another snake
        if(state.GameRules.snokesCollide){
          playerIndex = parseInt(i);
          for ( x in state.players){

              for (let cell of state.players[x].snake){
                if (cell.x == player.pos.x && cell.y == player.pos.y){
                  if (state.players[x].number == player.number){
                    break;
                  }
                  resetPlayer(state, player)
                }
              }
          }
        }

        player.snake.push({ ...player.pos });
        player.snake.shift();


      }
  }
  return false;
}

// spawn apple
function randomFood(state) {
  food = {
    x: Math.floor(Math.random() * state.gridsize),
    y: Math.floor(Math.random() * state.gridsize),
  }

  // ##TODO - make this actually work
  // // dont spawn on snake
  // for (i in state.players) {
  //   for (cell in state.players[i].snake){
  //     if (cell.x == food.x && cell.y == food.y) {
  //       console.log("Overlapping food");
  //       return randomFood(state);
  //     }
  //   }
  // }

  state.food = food;
}

function getUpdatedVelocity(state, player, keyCode) {
  if (player.inputting) {
    console.log("Blocked: "+keyCode);
    return;
  }
  directionVector = { x: player.vel.x, y: player.vel.y};




    

  player.inputting = true;
    // freeze snoke
    // if (keyCode == 27 )
    //     directionVector = { x: 0, y: 0};

    // ##TODO - refactor velocity system 
    if ((keyCode == 37 || keyCode == 65 || keyCode == "left") &&  (state.GameRules.allowReversing ? true:!player.direction.right)) //left
    {
      let newDirection = 'left';
      playerSetDirection(player, newDirection);
      directionVector = { x: -1, y: 0 };
    }

    if ((keyCode == 38 || keyCode == 87 || keyCode == "up") && (state.GameRules.allowReversing ? true:!player.direction.up)) //down
    {
      let newDirection = 'down';
      playerSetDirection(player, newDirection);
      directionVector = { x: 0, y: -1 };
    }
    if ((keyCode == 39 || keyCode == 68 || keyCode == "right") && (state.GameRules.allowReversing ? true:!player.direction.left)) //right
    {
      let newDirection = 'right';
      playerSetDirection(player, newDirection);
      directionVector = { x: 1, y: 0 };
    }
    if ((keyCode == 40 || keyCode == 83 || keyCode == "down") && (state.GameRules.allowReversing ? true:!player.direction.down)) //up
    {
      let newDirection = 'up';
      playerSetDirection(player, newDirection);
      directionVector = { x: 0, y: 1 };
    }
    player.inputting = false;
    player.vel = directionVector;
  

}

function playerSetDirection(player, newDirection){
  player.direction.down = false;
  player.direction.up = false;
  player.direction.right = false;
  player.direction.left = false;
  player.direction[newDirection] = true;
}

function createPlayer(state) {
  playerNumber = state.players.length +1;
    let newPlayer = {
        colour: randomColour(),
        number: playerNumber,
        score: 0,
        lastScore: 0,
        inputting: false,
        inputStack: [],
        direction: {
          right: false,
          left: false,
          up: false,
          down: true
        },
        pos: {
          x: 8,
          y: 10,
        },
        vel: {
          x: 1,
          y: 0,
        },
        snake: [
          {x: 1, y: 10},
          {x: 2, y: 10},
          {x: 3, y: 10},
        ],
      }
      state.players.push(newPlayer);
      console.log(`generated ${newPlayer.colour}`)
      return playerNumber;
}


function updateGameRules(state){

}


function resetPlayer(state, player){
  player.pos.x = player.pos.y = state.gridsize / 2;
  player.snake = player.snake.slice(0,3);
  player.score = 0; // we can potentially make score loss dynamically based on the event

}