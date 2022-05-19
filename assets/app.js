const usernameInput = document.getElementById('username');
const button = document.getElementById('join_leave');
const container = document.getElementById('container');
const count = document.getElementById('count');
const local = document.getElementById('local');
const playVideo = document.getElementById('playVideo');
let connected = false;
let room;
let extraVideoTrack;
let extraAudioTrack;

const addLocalVideo = async () => {
  const track = await Twilio.Video.createLocalVideoTrack();
  const video = local.firstElementChild;
  video.appendChild(track.attach());
};

window.ondragover = (ev) => {
  ev.preventDefault();
};

window.ondrop = (ev) => {
  ev.preventDefault();
};

playVideo.ondragover = () => {
  playVideo.classList.add('drop');
};

playVideo.ondragleave = () => {
  playVideo.classList.remove('drop');
};

playVideo.ondrop = async (ev) => {
  playVideo.classList.remove('drop');
  if (extraVideoTrack || extraAudioTrack) {
    await playVideo.onended();
  }
  playVideo.src = URL.createObjectURL(ev.dataTransfer.files[0]);
};

playVideo.oncanplaythrough = async () => {
  if (connected && !extraVideoTrack && !extraAudioTrack) {
    const stream = playVideo.captureStream();
    if (stream.getVideoTracks().length > 0) {
      const videoStream = stream.getVideoTracks()[0];
      extraVideoTrack = new Twilio.Video.LocalVideoTrack(videoStream);
      await room.localParticipant.publishTrack(extraVideoTrack);
    }
    if (stream.getAudioTracks().length > 0) {
      const audioStream = stream.getAudioTracks()[0];
      extraAudioTrack = new Twilio.Video.LocalAudioTrack(audioStream);
      await room.localParticipant.publishTrack(extraAudioTrack);
    }
  }
  playVideo.play();
};

playVideo.onended = async () => {
  if (extraVideoTrack) {
    await room.localParticipant.unpublishTrack(extraVideoTrack);
    extraVideoTrack = null;
  }
  if (extraAudioTrack) {
    await room.localParticipant.unpublishTrack(extraAudioTrack);
    extraAudioTrack = null;
  }
  playVideo.removeAttribute('src');
};

const connectButtonHandler = async (event) => {
  event.preventDefault();
  if (!connected) {
    const username = usernameInput.value;
    if (!username) {
      alert('Enter your name before connecting');
      return;
    }
    button.disabled = true;
    button.innerHTML = 'Connecting...';
    try {
      await connect(username);
      button.innerHTML = 'Leave call';
      button.disabled = false;
    }
    catch {
      alert('Connection failed. Is the backend running?');
      button.innerHTML = 'Join call';
      button.disabled = false;    
    }
  }
  else {
    disconnect();
    button.innerHTML = 'Join call';
    connected = false;
  }
};

const connect = async (username) => {
  const response = await fetch('/get_token', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({'username': username}),
  });
  const data = await response.json();
  room = await Twilio.Video.connect(data.token);
  room.participants.forEach(participantConnected);
  room.on('participantConnected', participantConnected);
  room.on('participantDisconnected', participantDisconnected);
  connected = true;
  updateParticipantCount();
};

const updateParticipantCount = () => {
  if (!connected) {
    count.innerHTML = 'Disconnected.';
  }
  else {
    count.innerHTML = (room.participants.size + 1) + ' participants online.';
  }
};

const participantConnected = (participant) => {
  const participantDiv = document.createElement('div');
  participantDiv.setAttribute('id', participant.sid);
  participantDiv.setAttribute('class', 'participant');

  const tracksDiv = document.createElement('div');
  participantDiv.appendChild(tracksDiv);

  const labelDiv = document.createElement('div');
  labelDiv.innerHTML = participant.identity;
  participantDiv.appendChild(labelDiv);

  container.appendChild(participantDiv);

  participant.tracks.forEach(publication => {
    if (publication.isSubscribed) {
      trackSubscribed(tracksDiv, publication.track);
    }
  });
  participant.on('trackSubscribed', track => trackSubscribed(tracksDiv, track));
  participant.on('trackUnsubscribed', trackUnsubscribed);
  updateParticipantCount();
};

const participantDisconnected = (participant) => {
  document.getElementById(participant.sid).remove();
  updateParticipantCount();
};

const trackSubscribed = (div, track) => {
  div.appendChild(track.attach());
};

const trackUnsubscribed = (track) => {
  track.detach().forEach(element => element.remove());
};

const disconnect = () => {
  room.disconnect();
  while (container.lastChild.id != 'local') {
      container.removeChild(container.lastChild);
  }
  button.innerHTML = 'Join call';
  connected = false;
  updateParticipantCount();
};

addLocalVideo();
button.addEventListener('click', connectButtonHandler);

