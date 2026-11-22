// lib/mini-gl.js —— 你的极简 WebGL2 武器库 (封印所有烦人的状态机八股文)

/**
 * 1. 编译顶点着色器(vs)与片元着色器(fs)，返回 WebGLProgram
 */
export function createProgram(gl, vsSource, fsSource) {
  function compile(type, source, label) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source.trim());
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`${label} 编译失败:\n${info}`);
    }
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vsSource, 'Vertex Shader'));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSource, 'Fragment Shader'));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Program 链接失败:\n' + gl.getProgramInfoLog(program));
  }
  return program;
}

/**
 * 2. 往 attribute 进料口塞顶点数据 (封装 createBuffer + bindBuffer + bufferData + vertexAttribPointer)
 * @param {number} size 每个顶点取几个数 (2D坐标填2，3D坐标填3，RGBA颜色填4)
 * @param {number} stride 步长字节数(默认0表示紧密排列)
 * @param {number} offset 起始偏移字节数(默认0)
 */
export function setAttribute(gl, program, name, dataArray, size, stride = 0, offset = 0) {
  const loc = gl.getAttribLocation(program, name);
  if (loc === -1) return null;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const typedData = dataArray instanceof Float32Array ? dataArray : new Float32Array(dataArray);
  gl.bufferData(gl.ARRAY_BUFFER, typedData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
  return buffer;
}

/**
 * 3. 把 Image 或 Canvas 2D 画布变成 WebGL 纹理 (封装 createTexture + texImage2D)
 */
export function createTextureFromSource(gl, source, premultiplyAlpha = true) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return tex;
}

/**
 * 4. 创建 FBO 离屏帧缓冲对象 (用于第 5 课预合成 refId 与后处理滤镜)
 */
export function createFramebufferTexture(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { fbo, texture, width, height };
}
