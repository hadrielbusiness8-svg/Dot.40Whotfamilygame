const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve your single-file HTML game interface
app.use(express.static(path.join(__dirname, 'public'))); 
// Make sure your index.html is inside a folder named 'public'

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Mount the PeerJS server on a sub-route so it doesn't overwrite your game UI
const peerServer = ExpressPeerServer(server, {
    debug: true
});

app.use('/peerjs', peerServer);
