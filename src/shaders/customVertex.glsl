void main() {
    // Basic vertex shader
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
