function sim(n:number, a:number, s:number, c:number, steps=600, turn=0.15, blind=Math.PI/3, noise=0.1){
  let b=20260919; const r=()=>{b=(b*1664525+1013904223)%4294967296;return b/4294967296;};
  const zor=Math.max(0.3,s), zoo=a*5, zoa=c*14; const ag:any[]=[];
  for(let i=0;i<n;i++){const q=r()*Math.PI*2; ag.push({x:(r()-0.5)*20,y:(r()-0.5)*20,a:q});}
  for(let l=0;l<steps;l++){
    const nb=ag.map(q=>({...q}));
    for(let i=0;i<n;i++){
      let rx=0,ry=0,nr=0,ox=0,oy=0,no=0,tx=0,ty=0,nt=0;
      for(let j=0;j<n;j++){if(i===j)continue; const dx=ag[j].x-ag[i].x,dy=ag[j].y-ag[i].y,d=Math.hypot(dx,dy); if(d<1e-9)continue;
        const rel=Math.atan2(Math.sin(Math.atan2(dy,dx)-ag[i].a),Math.cos(Math.atan2(dy,dx)-ag[i].a));
        if(Math.abs(rel)>Math.PI-blind/2)continue;
        if(d<zor){rx-=dx/d;ry-=dy/d;nr++;}
        else if(d<zor+zoo){ox+=Math.cos(ag[j].a);oy+=Math.sin(ag[j].a);no++;}
        else if(d<zor+zoo+zoa){tx+=dx/d;ty+=dy/d;nt++;}}
      let dx=Math.cos(ag[i].a), dy=Math.sin(ag[i].a);
      if(nr>0){dx=rx;dy=ry;} else if(no+nt>0){dx=0;dy=0; if(no>0){dx+=ox/no;dy+=oy/no;} if(nt>0){dx+=tx/nt;dy+=ty/nt;}}
      const want=Math.atan2(dy,dx)+(r()-0.5)*noise;
      let da=Math.atan2(Math.sin(want-ag[i].a),Math.cos(want-ag[i].a)); if(Math.abs(da)>turn)da=Math.sign(da)*turn;
      nb[i].a=ag[i].a+da; nb[i].x=ag[i].x+Math.cos(nb[i].a)*0.3; nb[i].y=ag[i].y+Math.sin(nb[i].a)*0.3;}
    for(let i=0;i<n;i++)ag[i]=nb[i];}
  let px=0,py=0; for(const q of ag){px+=Math.cos(q.a);py+=Math.sin(q.a);} const P=Math.hypot(px,py)/n;
  const mx=ag.reduce((t,q)=>t+q.x,0)/n,my=ag.reduce((t,q)=>t+q.y,0)/n; let pu=0,sp=0;
  for(const q of ag){const x=q.x-mx,y=q.y-my,rr=Math.hypot(x,y);sp+=rr;if(rr>1e-9)pu+=(x*Math.sin(q.a)-y*Math.cos(q.a))/rr;}
  const M=Math.abs(pu)/n, R=sp/n;
  const st = P>0.75?"SEARAH":M>0.45?"PUTAR":R<9.6?"gerombol":"pencar";
  return `${st.padEnd(8)} P${P.toFixed(2)} M${M.toFixed(2)} R${R.toFixed(1)}`;
}
for(const c of [0.6,1,1.5]){ for(const a of [0,0.05,0.1,0.2,0.3,0.5,0.8,1.2,1.8,2.5,3]) console.log(`c${c} a${a}: ${sim(40,a,1,c)}`); }
console.log("s0.4 a0 c0:", sim(40,0,0.4,0));
