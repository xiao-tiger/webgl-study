# 从 Canvas 2D 到 WebGL2 渲染引擎实战教程
> **专为有 Canvas 2D 基础的高级前端定制 —— 手写复刻 `predy-js/player` (Galacean Effects / Mars 体系) 核心渲染管线**

---

## 目录与练习指南

为什么以前看 WebGL 教程觉得天书一样？因为传统教程一上来就逼你背 60 行 C 语言风格的底层状态机 API。
在这套教程里，我们采用**「先封装 30 行底层工具函数，再专心写 15 行核心图形逻辑」**的工业级工程方法。

全套教程共 **6 课**，每一课都只有 **1 个独立的 HTML 文件**（零第三方依赖，在你的 Mac 本地双击或用 VS Code `Live Server` 打开就能跑）。**强烈建议你在本地新建一个空文件，照着每课的【手写步骤】亲手敲一遍！**

| 课程 | 本地练习文件 | 你将亲手实现的 Demo | 对应 `predy-js/player` 的真实源码模块 |
| :--- | :--- | :--- | :--- |
| **前置基建** | [`lib/mini-gl.js`](./lib/mini-gl.js) | 封装 40 行 WebGL2 八股文工具库（以后永远复用它） | `GLRenderer` / `Shader` / `Geometry` 底层封装 |
| **第 1 课** | [`01-triangle-and-rect.html`](./01-triangle-and-rect.html) | NDC 坐标系、varying 彩色渐变三角形、2 个三角形拼矩形 | 基础 Mesh 面片渲染与 `startColor` |
| **第 2 课** | [`02-canvas2d-texture.html`](./02-canvas2d-texture.html) | 用离屏 Canvas 2D 画胶囊与文字，转为 WebGL2 纹理并加波浪滤镜 | `type: "9"` (TextItem) & `type: "svg"` 矢量贴图渲染 |
| **第 3 课** | [`03-transform-and-camera.html`](./03-transform-and-camera.html) | 锚点 (`anchor`)、平移/旋转/缩放矩阵与 3D 透视相机 (`fov: 35`) | `transform` (`position/size/rotation`) & `camera` |
| **第 4 课** | [`04-binary-shapes-and-alpha.html`](./04-binary-shapes-and-alpha.html) | 解码 Predy JSON 的 `bins` 二进制形状 (`drawElements`) 与预乘 Alpha 混合 | `shapes` + `bins[0].b64` + `blending: 0` |
| **第 5 课** | [`05-fbo-and-postprocess.html`](./05-fbo-and-postprocess.html) | FBO 离屏帧缓冲：把子合成渲染成纹理，再做二次滤镜与遮罩 | `type: "7"` (`refId` 预合成) & `maskMode` / 后处理特效 |
| **第 6 课** | [`06-mini-predy-player.html`](./06-mini-predy-player.html) | **终极毕业设计**：200 行代码完整驱动真实线上 Predy JSON 动效播放！ | `predy-js/player` 完整渲染主循环与贝塞尔关键帧插值 |

---

## 前置基建：先写一个 45 行的 `lib/mini-gl.js`，永久封印八股文！

在你的练习目录下新建 [`lib/mini-gl.js`](./lib/mini-gl.js)。
**你只需要把这个文件敲一遍并加上注释**，理解它做的 4 件事（编译图纸、塞顶点数组、传全局常量、上传贴图），后面 6 节课你再也不用写这些啰嗦代码了！

```javascript
// lib/mini-gl.js —— 你的极简 WebGL2 武器库

/**
 * 1. 编译顶点着色器(vs)与片元着色器(fs)，返回 WebGLProgram
 */
export function createProgram(gl, vsSource, fsSource) {
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source.trim());
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader 编译失败:\n' + info);
    }
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Program 链接失败:\n' + gl.getProgramInfoLog(program));
  }
  return program;
}

/**
 * 2. 往 attribute 进料口塞顶点数据 (封装了 createBuffer + bindBuffer + bufferData + vertexAttribPointer)
 * @param {number} size 每个顶点取几个数 (比如 2D 坐标填 2，3D 坐标填 3，RGBA 颜色填 4)
 */
export function setAttribute(gl, program, name, dataArray, size) {
  const loc = gl.getAttribLocation(program, name);
  if (loc === -1) return null; // 如果 Shader 里没用到该变量会被 GPU 自动优化掉
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const typedData = dataArray instanceof Float32Array ? dataArray : new Float32Array(dataArray);
  gl.bufferData(gl.ARRAY_BUFFER, typedData, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  return buffer;
}

/**
 * 3. 把 Image 或 Canvas 2D 画布变成 WebGL 纹理 (封装了 createTexture + texImage2D)
 */
export function createTextureFromSource(gl, source, premultiplyAlpha = true) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // 预乘 Alpha：解决半透明文字/贴纸边缘发黑的核心设置！
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  return tex;
}
```

---

## 第 1 课：告别像素坐标 —— NDC 裁剪空间与双三角形拼矩形

### 核心知识点（写代码前先默念 3 遍）
1. **WebGL 中心是 `(0, 0)`**：不管 `<canvas>` 宽高是多少像素，WebGL 的 X 轴和 Y 轴范围永远是 **`-1.0` 到 `+1.0`**，且 **Y 轴向上为正**。
2. **WebGL 没有 `fillRect`**：任何矩形图层（包括 `predy-js/player` 里的背景、图片、文字框）都是由 **2 个三角形（6 个顶点）** 拼出来的。
3. **`varying` 插值**：你在顶点着色器里给 3 个角赋不同的颜色，GPU 光栅化时会自动算出三角形内部几万个像素的平滑过渡色。

### 动手默写练习：[`01-triangle-and-rect.html`](./01-triangle-and-rect.html)
请新建文件并手敲以下代码：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>第 1 课：双三角形拼矩形与 Varying 颜色插值</title>
  <style>
    body { margin: 0; background: #111; color: #eee; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px; }
    canvas { border: 1px solid #333; background: #1a1c29; }
  </style>
</head>
<body>
  <h3>第 1 课：手写 2 个三角形拼出渐变矩形 (对应 Predy 背景图层)</h3>
  <canvas id="gl-canvas" width="600" height="400"></canvas>

  <script type="module">
    import { createProgram, setAttribute } from './lib/mini-gl.js';

    const canvas = document.getElementById('gl-canvas');
    // 获取 WebGL2 上下文（predy-js/player 使用的也是 webgl2）
    const gl = canvas.getContext('webgl2');

    // 1. 顶点着色器 (Vertex Shader)：每个顶点执行 1 次
    const vs = `
      attribute vec2 a_pos;   // 顶点坐标 (x, y)
      attribute vec3 a_color; // 顶点颜色 (r, g, b)
      varying vec3 v_color;   // 传给片元着色器做平滑插值

      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
        v_color = a_color;
      }
    `;

    // 2. 片元着色器 (Fragment Shader)：三角形内的每个像素执行 1 次
    const fs = `
      precision mediump float;
      varying vec3 v_color;

      void main() {
        gl_FragColor = vec4(v_color, 1.0);
      }
    `;

    const program = createProgram(gl, vs, fs);
    gl.useProgram(program);

    // 3. 用 2 个三角形 (6 个顶点) 拼出一个矩形
    const positions = [
      // 第 1 个三角形 (左上 -> 左下 -> 右上)
      -0.6,  0.6,
      -0.6, -0.6,
       0.6,  0.6,
      // 第 2 个三角形 (左下 -> 右下 -> 右上)
      -0.6, -0.6,
       0.6, -0.6,
       0.6,  0.6,
    ];
    setAttribute(gl, program, 'a_pos', positions, 2);

    // 4. 给 6 个顶点分别指定 RGB 颜色 (范围 0.0 ~ 1.0)
    const colors = [
      1.0, 0.39, 0.18,  // 左上：Predy 橙
      0.2, 0.83, 0.60,  // 左下：翠绿
      0.38, 0.65, 0.98, // 右上：天蓝

      0.2, 0.83, 0.60,  // 左下：翠绿
      0.95, 0.75, 0.20, // 右下：金黄
      0.38, 0.65, 0.98, // 右上：天蓝
    ];
    setAttribute(gl, program, 'a_color', colors, 3);

    // 5. 清空画布并绘制 6 个顶点！
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.11, 0.16, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  </script>
</body>
</html>
```

#### 课后自测小作业（改 2 行代码验证你真的懂了）：
1. 如果把最后一行 `gl.drawArrays(gl.TRIANGLES, 0, 6)` 改成 `gl.drawArrays(gl.LINE_LOOP, 0, 6)`，画面会变成什么？（答案：变成线框模式，你能清晰看到矩形是由哪两个三角形拼出来的！）
2. 试着在 `vs` 里加一个 `uniform float u_scale;`，把 `gl_Position = vec4(a_pos * u_scale, 0.0, 1.0);`，然后在 JS 里用 `gl.uniform1f(gl.getUniformLocation(program, 'u_scale'), 0.5)` 把矩形缩小一半。

---

## 第 2 课：Canvas 2D + WebGL2 双剑合璧 —— 渲染文字、SVG 胶囊与动态滤镜

### 核心知识点（直击 `predy-js/player` 的 `type: "9"` 和 `type: "svg"`）
1. **WebGL 不会直接写汉字**：在 `predy-js/player` 中，遇到 `"text": { "t": "让灵感，动起来。" }` 或 `"type": "svg"` 时，引擎会在内存里建一个 `document.createElement('canvas')`，用 **Canvas 2D** 把文字和圆角胶囊画好，然后调用 `gl.texImage2D` 把这个 2D 画布上传成 WebGL 的一张贴图（`sampler2D`）。
2. **UV 坐标 (`0.0 ~ 1.0`)**：不管贴图是多少像素，左下角是 `(0, 0)`，右上角是 `(1, 1)`。注意 HTML Canvas 的 `(0, 0)` 在左上角，所以在 Shader 里要把 Y 轴翻过来：`vec2(a_uv.x, 1.0 - a_uv.y)`。

### 动手默写练习：[`02-canvas2d-texture.html`](./02-canvas2d-texture.html)

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>第 2 课：Canvas 2D 文字/SVG 转 WebGL 贴图与 Shader 特效</title>
  <style>
    body { margin: 0; background: #111; color: #eee; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px; }
    canvas { border: 1px solid #333; }
  </style>
</head>
<body>
  <h3>第 2 课：复刻 Predy 胶囊与文字图层 + 水波 Shader 特效</h3>
  <canvas id="gl-canvas" width="600" height="400"></canvas>

  <script type="module">
    import { createProgram, setAttribute, createTextureFromSource } from './lib/mini-gl.js';

    // 第一步：用你最拿手的 Canvas 2D 在离屏画布上画出 Predy 的圆角胶囊和文字
    function createPredyCapsuleCanvas(text) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 160;
      const ctx = c.getContext('2d');

      // 对应 Predy JSON comp_28 item_402: 橙色圆角胶囊 (rgb: 1.0, 0.392, 0.176)
      ctx.fillStyle = 'rgb(255, 100, 45)';
      ctx.beginPath();
      ctx.roundRect(16, 16, 480, 128, 64);
      ctx.fill();

      // 对应 Predy JSON item_417: 文字渲染
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, c.width / 2, c.height / 2);
      return c;
    }

    const canvas = document.getElementById('gl-canvas');
    const gl = canvas.getContext('webgl2');

    const vs = `
      attribute vec2 a_pos;
      attribute vec2 a_uv;
      varying vec2 v_uv;

      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
        // 翻转 Y 轴，使 Canvas 2D 的左上角对齐 WebGL 矩形的左上角
        v_uv = vec2(a_uv.x, 1.0 - a_uv.y);
      }
    `;

    const fs = `
      precision mediump float;
      varying vec2 v_uv;
      uniform sampler2D u_tex;
      uniform float u_time;

      void main() {
        // 给 UV 加上一点随时间流动的正弦波偏移（如果不要特效，直接传 v_uv 即可）
        float wave = sin(v_uv.x * 6.0 - u_time * 3.0) * 0.03;
        vec2 uv = vec2(v_uv.x, clamp(v_uv.y + wave, 0.0, 1.0));
        gl_FragColor = texture2D(u_tex, uv);
      }
    `;

    const program = createProgram(gl, vs, fs);
    gl.useProgram(program);

    // 矩形的 6 个顶点坐标与对应的 6 个 UV 贴图坐标
    setAttribute(gl, program, 'a_pos', [
      -0.7,  0.3,   -0.7, -0.3,    0.7,  0.3,
      -0.7, -0.3,    0.7, -0.3,    0.7,  0.3,
    ], 2);

    setAttribute(gl, program, 'a_uv', [
       0.0,  1.0,    0.0,  0.0,    1.0,  1.0,
       0.0,  0.0,    1.0,  0.0,    1.0,  1.0,
    ], 2);

    // 把离屏 Canvas 2D 上传为 WebGL 纹理
    const capsuleCanvas = createPredyCapsuleCanvas('让灵感，动起来。');
    const texture = createTextureFromSource(gl, capsuleCanvas, true);

    // 开启预乘 Alpha 混合（让胶囊圆角外的透明区域能透出背景色！）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const uTimeLoc = gl.getUniformLocation(program, 'u_time');

    function render(now) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      // 背景色设为 Predy JSON item_420 的米白色 [0.965, 0.953, 0.925, 1]
      gl.clearColor(0.965, 0.953, 0.925, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uTimeLoc, now * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  </script>
</body>
</html>
```

---

## 第 3 课：为什么 Predy JSON 里的坐标是 `[1.45, -0.35, 0]`？—— 4×4 矩阵与 3D 透视相机

### 核心知识点（看懂 `predy-js/player` 的 `camera` 和 `transform`）
你在看昨天那个 JSON 时一定会奇怪：
* 为什么 `"背景"` 的 `size` 是 `[11.32, 6.36]`？
* 为什么 `"idea-dot"` 的 `position` 是 `[-2.75, 0.65, 0]`？它们既不是像素（800×600），也不是 `-1 ~ +1`！
* **答案就在 JSON 顶部的 `camera` 里**：
  ```json
  "camera": { "fov": 35, "near": 0.1, "far": 100, "position": [0, 0, 10] }
  ```
  `predy-js/player` 建立了一个 **3D 舞台**：摄像机站在距离屏幕 $Z = 10$ 的地方，张开 $35^\circ$ 的视角（`fov: 35`）往原点 $(0, 0, 0)$ 看。
  根据初中三角函数，在 $Z = 0$ 的舞台平面上，摄像机刚好能拍到的总高度是：
  $$H = 2 \times 10 \times \tan\left(\frac{35^\circ}{2}\right) \approx 6.306$$
  当画布是 16:9 时，能拍到的总宽度正好是 $6.306 \times \frac{16}{9} \approx 11.21$！所以背景图层的大小 `[11.32, 6.36]` 刚好铺满整个镜头！

* **在 WebGL 里怎么做平移、旋转、缩放和相机投影？**
  不用你手推矩阵公式！在工程里，我们用一个固定的 **4×4 矩阵乘法公式（MVP 矩阵）**：
  $$\text{gl\_Position} = \mathbf{M}_{\text{Projection (相机透视)}} \times \mathbf{M}_{\text{View (相机位置)}} \times \mathbf{M}_{\text{Model (图层自身的平移/旋转/缩放)}} \times \text{a\_pos}$$

### 动手默写练习：[`03-transform-and-camera.html`](./03-transform-and-camera.html)
在这一课中，我们把 `camera: { fov: 35, position: [0, 0, 10] }` 装进去，你就可以**直接填 Predy JSON 里的原始坐标 `[-2.75, 0.65, 0]` 和旋转角度**了！

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>第 3 课：复刻 Predy 3D 透视相机 (fov:35, z:10) 与图层 Transform</title>
  <style>
    body { margin: 0; background: #111; color: #eee; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px; }
    canvas { border: 1px solid #333; }
  </style>
</head>
<body>
  <h3>第 3 课：直接使用 Predy JSON 的真实 3D 坐标与透视相机</h3>
  <canvas id="gl-canvas" width="640" height="360"></canvas>

  <script type="module">
    import { createProgram, setAttribute } from './lib/mini-gl.js';
    import { mat4Perspective, mat4TRS, mat4Multiply } from './lib/mini-mat4.js';

    const canvas = document.getElementById('gl-canvas');
    const gl = canvas.getContext('webgl2');

    // 顶点着色器只多了一个 uniform mat4 u_mvp！
    const vs = `
      attribute vec3 a_pos;
      uniform mat4 u_mvp; // 相机透视 * 相机位置 * 图层自身变换

      void main() {
        gl_Position = u_mvp * vec4(a_pos, 1.0);
      }
    `;

    const fs = `
      precision mediump float;
      uniform vec4 u_color; // 对应 Predy JSON renderer.startColor

      void main() {
        gl_FragColor = u_color;
      }
    `;

    const program = createProgram(gl, vs, fs);
    gl.useProgram(program);

    // 标准 1x1 单位正方形网格 (-0.5 ~ +0.5)，任何尺寸的矩形只需通过 scale 放大即可！
    setAttribute(gl, program, 'a_pos', [
      -0.5,  0.5, 0,   -0.5, -0.5, 0,    0.5,  0.5, 0,
      -0.5, -0.5, 0,    0.5, -0.5, 0,    0.5,  0.5, 0,
    ], 3);

    const uMvpLoc = gl.getUniformLocation(program, 'u_mvp');
    const uColorLoc = gl.getUniformLocation(program, 'u_color');

    // 1. 构建 Predy JSON 里的相机投影矩阵: fov=35°, near=0.1, far=100, cameraZ=10
    const aspect = canvas.width / canvas.height;
    const viewProjMatrix = mat4Perspective(35, aspect, 0.1, 100, 10);

    // 封装一个绘制单个 Predy Item 的函数！
    function drawPredyItem({ position, rotation, size, color }) {
      const modelMatrix = mat4TRS(position, rotation, [size[0], size[1], 1]);
      const mvp = mat4Multiply(viewProjMatrix, modelMatrix);
      gl.uniformMatrix4fv(uMvpLoc, false, mvp);
      gl.uniform4fv(uColorLoc, color);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function render(now) {
      const t = now * 0.001;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.1, 0.1, 0.12, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // 绘制 Predy JSON 里的 item_420 ("背景")
      drawPredyItem({
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        size: [11.3227, 6.3690],
        color: [0.965, 0.953, 0.925, 1.0]
      });

      // 绘制 Predy JSON 里的 item_418 ("idea-line")，并让它在 3D 空间里绕 Y/Z 轴旋转！
      drawPredyItem({
        position: [0, -0.35, 0],
        rotation: [0, Math.sin(t * 2) * 35, t * 45], // 真正的 3D 透视旋转！
        size: [3.2, 0.8],
        color: [1.0, 0.392, 0.176, 1.0]
      });

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  </script>
</body>
</html>
```

---

## 第 4 课：解码 Predy JSON 里的二进制 `bins` 与 `shapes` (`drawElements` 索引绘制)

### 核心知识点（看懂 `shapes: [{"v": [0, 328, 3], "i": [0, 1312, 180]}]`）
在第 1 课画矩形时，一个正方形明明只有 **4 个角**，我们为了凑 2 个三角形却写了 **6 个顶点**（左上和右下重复写了两次）。
如果是画一个精细的圆点（比如 Predy JSON 里的 `item_419` `"idea-dot"`，由 60 个三角形组成），如果每个三角形都重复写顶点，数据体积会膨胀好几倍！

所以 `predy-js/player` 用了 WebGL 的 **索引缓冲（IBO / `ELEMENT_ARRAY_BUFFER`）**：
1. **`v`（Vertices 顶点表）**：只存不重复的顶点坐标；
2. **`i`（Indices 索引表）**：存三角形是由哪 3 个顶点编号连起来的，比如 `[0, 1, 2, 1, 3, 2]`；
3. **打包成二进制 Base64 (`bins[0].b64`)**：把顶点 `Float32Array` 和索引 `Uint16Array` 拼在同一个二进制块里，前端用 `atob()` 解码成 `ArrayBuffer`，直接切片喂给 `gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0)`！

*(完整可运行代码已生成在 [`04-binary-shapes-and-alpha.html`](./04-binary-shapes-and-alpha.html) 中，直接解码了你发的 JSON 里的真实 Base64 二进制圆点！)*

---

## 第 5 课：FBO 离屏帧缓冲 —— 预合成 (`type: "7"`, `refId`) 与全局后处理滤镜

### 核心知识点（你在 `predy-js/player` 写新特效/遮罩最常用的一课）
* 在 Predy JSON 里，主合成 `comp_29` 里面有 4 个 `type: "7"` 的图层（`tile-0` ~ `tile-3`），它们都指向同一个子合成 `"refId": "comp_28"`。
* WebGL 怎么实现这种「先把子合成画好，再当成一张图片贴进主合成里复制 4 份，或者加整体模糊滤镜」？
* 答案是 **FBO（Framebuffer Object，帧缓冲对象）**：
  1. 平时 `gl.bindFramebuffer(gl.FRAMEBUFFER, null)` 是直接画到**屏幕 Canvas** 上；
  2. 当你绑定到一个自定义 `fbo` 时，你画的所有三角形都会被画进一张**空白纹理 `fboTexture`** 里；
  3. 接着切换回屏幕，把刚才画好的 `fboTexture` 当成普通贴图画出来，想复制几份、加什么发光/模糊/遮罩滤镜都随你！

*(完整可运行代码已生成在 [`05-fbo-and-postprocess.html`](./05-fbo-and-postprocess.html) 中。)*

---

## 第 6 课（毕业大作）：200 行代码手写 `Mini-Predy-Player`，直接播放你的线上 JSON！

当你把前 5 课的代码都敲通之后，打开 [`06-mini-predy-player.html`](./06-mini-predy-player.html)。
在这最后一课里，我们没有引入任何第三方库，只用前面 5 课学到的：
1. `camera` 3D 透视矩阵（第 3 课）
2. `bins` + `shapes` 二进制顶点渲染（第 4 课）
3. 离屏 Canvas 2D 渲染 `type: "9"` 文字与 `type: "svg"` 胶囊（第 2 课）
4. 父子节点 `parentId` 矩阵相乘与三段式贝塞尔曲线插值器

**直接加载并实时播放了你发给我的 `https://picasso-static.xiaohongshu.com/predy/104102q0327rujjqqmq062u66oe2t1co005lu9muts7geq` 完整动效！**
