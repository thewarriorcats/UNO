/*
	Threat events about
	the home room.
	The home room is room where
	everyone joins as soon they
	access the application.
*/
const database = require("./database");
const {Room} = require("./DatabaseConnection");


/* Trigger in hard and final disconnect aka close webpage */
module.exports.disconnect = function (socket) {
    socket.on("disconnect", async data => {
        console.log(`\nPlayer ${socket.id} has been disconnected\n`);
        try
        {
            const room = await Room.findOne({players: {$elemMatch: {socketId: socket.id}}});
            if(room)
            {
                const player = room.players.find(r => r.socketId === socket.id);
                player.remove();
                if(room.players.length === 0 ||
                    room.players.filter(a => a.name !== player.name).every(a => a.isBot))
                    await room.remove();
                else
                    await room.save();
                
                socket.broadcast.to(room.name).emit("/hall/exit-member", {
                    message: {
                        from: {id: "THE DOCTOR", name: "SYSTEM"},
                        text: `${player.name} saiu da sala.`
                    },
                    playerId: player.socketId
                });
                
                socket.leave(room.name);
                socket.broadcast.to("__HOME").emit("/home/load-all-rooms", await Room.find({}));
            }
        }catch(err){
            console.log(err);  
        }
    });
}


/* Trigger in init home scene */
module.exports.joinHome = function (socket) {
    socket.on("/app/join/home", data => {
        socket.join("__HOME");
        socket.emit("/app/join/home/success", "__HOME");
    });
}


/* Request a list of all rooms created */
module.exports.loadAllRooms = function (socket) {
    socket.on("/home/load-all-rooms", async data => {
        try
        {
            socket.emit("/home/load-all-rooms", await Room.find({}));
        }catch(err){
            console.log(err);
        }
    });
}


/* Attemps to create a new room */
module.exports.createRoom = function (socket) {
    socket.on("/home/create-room", async data => {
        try
        {
            if((await Room.findOne({name: data.name})))
            {
                socket.emit("/home/create-room/fail", {
                    created: false,
                    message: `Falha ao criar sala, este nome já se encontra em uso.`
                });
            }
            else
            {
                const player = {
                    socketId: socket.id,
                    name: data.nickName,
                    connectedSince: new Date().getTime(),
                    roomName: data.name,
                    isBot: false
                };
                const room = new Room({
                    name: data.name,
                    status: "WAITING",
                    capacity: data.capacity,
                    playerTurn: 0,
                    admin: player,
                    cards: [],
                    players: [player]
                });
                await room.save();
                socket.leave("__HOME");
                socket.broadcast.to("__HOME").emit("/home/load-all-rooms", await Room.find({}));
                socket.emit("/home/create-room/success", {
                    created: true,
                    message: 'Sala criada com sucesso!',
                    roomName: data.name
                });
            }
        }catch(err){
            console.log(err);
        }
    });
}


/* Attemps to join in a room */
module.exports.joinRoom = function (socket) {
    socket.on("/home/join-room", async data => {
        try
        {
            const room = await Room.findOne({name: data.room});

            if(room.players.length === room.capacity)
                return socket.emit("/home/join-room/fail", "Sala esta esta lotada!");
            if(room.players.find(p => p.name === data.nickName))
                return socket.emit("/home/join-room/fail", "Este nickname já existe");
            const player = {
                socketId: socket.id,
                name: data.nickName,
                connectedSince: new Date().getTime(),
                roomName: room.name,
                isBot: false
            };
            socket.leave("__HOME");
            room.players.push(player);
            if(room.players.length === room.capcity)
                room.status = "IN GAME";
            await room.save();
            socket.emit("/hall/join-room/successful", room.name);
        }catch(err){
            console.log(err);
        }
    });
}