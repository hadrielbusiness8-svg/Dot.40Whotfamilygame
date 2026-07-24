const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9000;

// 1. Serve your single-file HTML Whot game from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
    console.log(`Dot.40 Whot Server running on port ${PORT}`);
});

// 2. Configure the PeerJS signaling server
const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: 'dot-40-whot.onrender.com', 
});

// 3. Mount the PeerJS server to the /peerjs route
app.use('/peerjs', peerServer);
