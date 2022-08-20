let APP_ID = "9cb2fa92d2e044ec8bcd32ddbb432ea3";

let token = null;
let uid = String (Math.floor (Math.random () * 10000))
let queryString = window.location.search;
let uelParams   = new URLSearchParams (queryString);
let roomId = uelParams.get ("room");

let client;
let channel;

let localStream;
let remoteStream;
let peerConnection;

if (!roomId) {
    window.location = "lobby.html";
}

const servers = {
    iceServers : [
        {
            urls : ["stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"]
        }
    ]
}


let init = async () => {
    client = await AgoraRTM.createInstance (APP_ID);
    await client.login ({uid, token});

    channel = client.createChannel (roomId)
    await channel.join ();

    channel.on ("MemberJoined", handleUserJoined);
    channel.on ("MemberLeft", handleUserLeft);

    client.on ("MessageFromPeer", handleMessageFromPeer);

    localStream = await navigator.mediaDevices.getUserMedia ({video : true, audio : false});
    document.getElementById ("user-1").srcObject = localStream;
}

let handleUserLeft = (MemberId) => {
    document.getElementById ("user-2").style.display = "none";
}

let handleMessageFromPeer = async (message, MemberId) => {

    message = JSON.parse(message.text)

    if(message.type === 'offer'){
        console.info ("GOT Offer", message.offer);
        createAnswer(MemberId, message.offer)
    }

    if(message.type === 'answer'){
        console.info ("GOT Answer", message.answer);
        addAnswer(message.answer)
    }

    if(message.type === 'candidate'){
        console.info ("GOT ICE Candidate", message.candidate);
        if(peerConnection){
            peerConnection.addIceCandidate(message.candidate)
        }
    }


}

let handleUserJoined = async (MemberId) => {
    // console.info ("A new user joined the channel:", MemberId)
    createOffer (MemberId);
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection (servers);

    remoteStream = new MediaStream ();
    document.getElementById ("user-2").srcObject = remoteStream;
    document.getElementById ("user-2").style.display = 'block';

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:false})
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks ().forEach(track => {
        peerConnection.addTrack (track, localStream)
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        console.log (event, "on ice candidate");
        if (event.candidate) {
            client.sendMessageToPeer ({text : JSON.stringify ({'type' : "candidate", "candidate" : event.candidate})}, MemberId);
        }
    }

}

let createOffer = async (MemberId) => {
    await createPeerConnection (MemberId);

    let offer = await peerConnection.createOffer ();
    await peerConnection.setLocalDescription (offer);

    client.sendMessageToPeer ({text : JSON.stringify ({'type' : "offer", "offer" : offer})}, MemberId);
}

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection (MemberId);

    await peerConnection.setRemoteDescription (offer);

    let answer = await peerConnection.createAnswer ();
    await peerConnection.setLocalDescription (answer);

    client.sendMessageToPeer ({text : JSON.stringify ({'type' : "answer", "answer" : answer})}, MemberId);
}

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription (answer);
    }
}

let leaveChannel = async () => {
    await channel.leave ();
    await client.logout ();
}

window.addEventListener ("beforeunload", leaveChannel);

init ();