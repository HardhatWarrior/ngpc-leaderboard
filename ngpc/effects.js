// Optional GPU presentation layer. The original 160x152 canvas and captures
// remain untouched, including screenshots used by QR readers.
const vertex=`attribute vec2 position; varying vec2 uv;
void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0.0,1.0);}`;
const fragment=`precision highp float;
uniform vec2 footprint;
uniform sampler2D picture; uniform int effect; varying vec2 uv;
// Integral of a periodic boundary: average coverage across each output pixel.
float pulseIntegral(float x,float duty){return floor(x)*duty+min(fract(x),duty);}
float boundary(float x,float width){return (pulseIntegral(x+width*0.5,0.10)-pulseIntegral(x-width*0.5,0.10))/width;}
float subpixel(float x,float width){return (pulseIntegral(x+width*0.5,1.0/3.0)-pulseIntegral(x-width*0.5,1.0/3.0))/width;}
void main(){
  vec2 p=vec2(uv.x,1.0-uv.y);
  vec3 color=texture2D(picture,p).rgb;
  if(effect==1){
    vec2 cell=fract(p*vec2(160.0,152.0));
    vec2 coverage=vec2(boundary(p.x*160.0,footprint.x),boundary(p.y*152.0,footprint.y));
    float grid=mix(0.82,1.0,(1.0-coverage.x)*(1.0-coverage.y));
    float x=p.x*160.0;
    vec3 mask=0.88+0.12*vec3(subpixel(x,footprint.x),subpixel(x-1.0/3.0,footprint.x),subpixel(x-2.0/3.0,footprint.x));
    color*=grid*mask;
  }else{
    float scan=0.90+0.10*cos(p.y*152.0*6.2831853);
    vec2 q=uv*2.0-1.0;
    color*=scan*(1.0-0.10*dot(q,q));
  }
  gl_FragColor=vec4(color,1.0);
}`;

export class ScreenEffects {
  constructor(source,onFailure){
    this.source=source;this.mode='off';
    this.surface=document.createElement('span');this.surface.className='screen-effect';
    this.surface.setAttribute('aria-hidden','true');
    Object.assign(this.surface.style,{position:'absolute',pointerEvents:'none',display:'none',zIndex:'1',lineHeight:'0'});
    this.canvas=document.createElement('canvas');
    this.canvas.style.cssText='display:block;width:100%;height:100%';
    // Isolate the GPU canvas from the player's normal canvas/fullscreen CSS.
    this.surface.attachShadow({mode:'open'}).append(this.canvas);
    const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
    if(!gl)throw Error('Display effects unavailable');
    const compile=(type,text)=>{
      const shader=gl.createShader(type);gl.shaderSource(shader,text);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw Error('Display effect compilation failed');}
      return shader;
    };
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
    this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Display effect linking failed');
    gl.useProgram(this.program);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(this.program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,160,152,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    this.footprint=gl.getUniformLocation(this.program,'footprint');
    this.effect=gl.getUniformLocation(this.program,'effect');gl.uniform1i(gl.getUniformLocation(this.program,'picture'),0);
    this.lost=e=>{e.preventDefault();onFailure();};this.canvas.addEventListener('webglcontextlost',this.lost);
    source.after(this.surface);
    this.resize=()=>{if(this.pixels)this.render(this.pixels);};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(source);
    window.addEventListener('resize',this.resize);
  }
  configure(mode,smooth){this.mode=mode;this.smooth=smooth;}
  render(pixels){
    this.pixels=pixels;
    const source=this.source,r=source.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const w=Math.min(r.width,r.height*160/152),h=w*152/160;
    const parent=source.offsetParent;if(!parent)return;
    const box=parent.getBoundingClientRect();
    Object.assign(this.surface.style,{left:`${r.left-box.left-parent.clientLeft+parent.scrollLeft+(r.width-w)/2}px`,top:`${r.top-box.top-parent.clientTop+parent.scrollTop+(r.height-h)/2}px`,width:`${w}px`,height:`${h}px`,display:'block'});
    // Match physical display pixels to avoid resampling the LCD mask a second time.
    // Bound exceptionally large displays to 2048 pixels across.
    const scale=Math.max(1,Math.min(2048/160,w*(window.devicePixelRatio||1)/160));
    const width=Math.round(160*scale),height=Math.round(152*scale);
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    const gl=this.gl;gl.viewport(0,0,width,height);gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    const filter=this.smooth?gl.LINEAR:gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,160,152,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    gl.uniform2f(this.footprint,160/width,152/height);
    gl.uniform1i(this.effect,this.mode==='lcd'?1:2);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  destroy(){
    this.observer?.disconnect();window.removeEventListener('resize',this.resize);
    this.canvas.removeEventListener('webglcontextlost',this.lost);this.surface.remove();
    const gl=this.gl;gl.deleteTexture(this.texture);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
