const button=document.getElementById('loadBoard');
button.addEventListener('click',()=>{const frame=document.getElementById('ufliBoard');frame.src='https://research.dwi.ufl.edu/op.n/file/bca9ju45kvvrvoan/?embed';frame.hidden=false;document.getElementById('embedConsent').hidden=true;});
