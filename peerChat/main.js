let APP_ID = "9cb2fa92d2e044ec8bcd32ddbb432ea3";
let constraints = {
    video : {
        width : { min : 620, ideal : 1920, max : 1920},
        height : {min : 480, ideal : 1080, max : 1080},
    },
    audio : true,
}


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

    localStream = await navigator.mediaDevices.getUserMedia (constraints);
    document.getElementById ("user-1").srcObject = localStream;
}

let handleUserLeft = (MemberId) => {
    document.getElementById ("user-2").style.display = "none";
    document.getElementById ("user-1").classList.remove ("smallFrame");
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
    createOffer (MemberId);
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection (servers);

    remoteStream = new MediaStream ();
    document.getElementById ("user-2").srcObject = remoteStream;
    document.getElementById ("user-2").style.display = 'block';

    document.getElementById ("user-1").classList.add ("smallFrame");
    dragElement (document.getElementById ("user-1"))

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia(constraints)
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

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks ().find (track => track.kind === "video");

    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById ("camera-btn").style.backgroundColor = "rgb(255, 80, 80)";
    } else {
        videoTrack.enabled = true;
        document.getElementById ("camera-btn").style.backgroundColor = "rgb(179, 102, 249, .9)";
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks ().find (track => track.kind === "audio");

    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById ("mic-btn").style.backgroundColor = "rgb(255, 80, 80)";
    } else {
        audioTrack.enabled = true;
        document.getElementById ("mic-btn").style.backgroundColor = "rgb(179, 102, 249, .9)";
    }
}

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    elmnt.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      /* stop moving when mouse button is released:*/
      document.onmouseup = null;
      document.onmousemove = null;
    }
}

window.addEventListener ("beforeunload", leaveChannel);
document.getElementById ("camera-btn").addEventListener ("click", toggleCamera);
document.getElementById ("mic-btn").addEventListener ("click", toggleMic);


init ();