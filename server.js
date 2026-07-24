const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();
// Render sets the PORT automatically
const PORT = process.env.PORT || 9000;

const server = app.listen(PORT, () => {
    console.log(`PeerJS server is running on port ${PORT}`);
});

// Initialize PeerJS Server
const peerServer = ExpressPeerServer(server, {
    proxied: true,
    path: '/'
});

app.use(peerServer);
