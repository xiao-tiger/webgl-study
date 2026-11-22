// lib/mini-mat4.js —— 专供 predy-js/player 3D 相机与图层变换的极简 4x4 矩阵库 (列主序 Float32Array)

export function mat4Identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 两个 4x4 矩阵相乘: out = a * b (用于 MVP 合成或父子节点 parentId 矩阵级联)
 */
export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

/**
 * 构建 Predy 3D 透视相机 ViewProjection 矩阵
 * 对应 JSON: camera: { fov: 35, near: 0.1, far: 100, position: [0, 0, 10] }
 */
export function mat4Perspective(fovDeg, aspect, near, far, cameraZ = 10) {
  const f = 1.0 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  const proj = new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
  // 相机位于 (0, 0, cameraZ)，因此视图矩阵相当于将世界沿 Z 轴平移 -cameraZ
  const view = mat4Identity();
  view[14] = -cameraZ;
  return mat4Multiply(proj, view);
}

/**
 * 根据图层的 position [x,y,z], rotation [rx,ry,rz (角度)], scale [sx,sy,sz] 构建 Model 矩阵
 */
export function mat4TRS(position = [0, 0, 0], rotationDeg = [0, 0, 0], scale = [1, 1, 1]) {
  const [tx, ty, tz] = position;
  const [rx, ry, rz] = rotationDeg.map(d => (d * Math.PI) / 180);
  const [sx, sy, sz] = scale;

  const cx = Math.cos(rx), sx_ = Math.sin(rx);
  const cy = Math.cos(ry), sy_ = Math.sin(ry);
  const cz = Math.cos(rz), sz_ = Math.sin(rz);

  // Z * Y * X 欧拉角旋转并结合缩放与平移
  const m = new Float32Array(16);
  m[0] = (cz * cy) * sx;
  m[1] = (sz_ * cy) * sx;
  m[2] = (-sy_) * sx;
  m[3] = 0;

  m[4] = (cz * sy_ * sx_ - sz_ * cx) * sy;
  m[5] = (sz_ * sy_ * sx_ + cz * cx) * sy;
  m[6] = (cy * sx_) * sy;
  m[7] = 0;

  m[8] = (cz * sy_ * cx + sz_ * sx_) * sz;
  m[9] = (sz_ * sy_ * cx - cz * sx_) * sz;
  m[10] = (cy * cx) * sz;
  m[11] = 0;

  m[12] = tx;
  m[13] = ty;
  m[14] = tz;
  m[15] = 1;
  return m;
}
