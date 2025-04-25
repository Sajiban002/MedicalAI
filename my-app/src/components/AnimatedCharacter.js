import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const AnimatedCharacter = ({ modelPath }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const modelRef = useRef(null);
  const mixerRef = useRef(null);
  const controlsRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize scene, camera, and renderer
    const initialize = () => {
      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f8ff); // Light blue background
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(
        45,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 1, 5);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.outputEncoding = THREE.sRGBEncoding;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 2, 3);
      directionalLight.castShadow = true;
      scene.add(directionalLight);

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 3;
      controls.maxDistance = 10;
      controls.maxPolarAngle = Math.PI / 2;
      controlsRef.current = controls;

      // Load model
      loadModel();

      // Handle resize
      window.addEventListener('resize', handleResize);
    };

    // Load GLTF model
    const loadModel = () => {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          console.log('Model loaded successfully:', gltf);
          
          const model = gltf.scene;
          model.traverse((node) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          
          // Center model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          
          sceneRef.current.add(model);
          modelRef.current = model;
          
          // Handle animations if they exist
          if (gltf.animations && gltf.animations.length) {
            const mixer = new THREE.AnimationMixer(model);
            mixerRef.current = mixer;
            
            const animation = gltf.animations[0]; // Use first animation
            const action = mixer.clipAction(animation);
            action.play();
          }
          
          // Adjust camera to model size
          const box3 = new THREE.Box3().setFromObject(model);
          const size = box3.getSize(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          cameraRef.current.position.z = maxSize * 2.5;
          
          // Start animation loop
          animate();
        },
        (progress) => {
          console.log('Loading progress:', Math.round((progress.loaded / progress.total) * 100), '%');
        },
        (error) => {
          console.error('Error loading model:', error);
        }
      );
    };

    // Animation loop
    const animate = () => {
      const animationId = requestAnimationFrame(animate);
      
      // Update animations mixer
      if (mixerRef.current) {
        const delta = clockRef.current.getDelta();
        mixerRef.current.update(delta);
      }
      
      // Rotate model slightly
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.005;
      }
      
      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      return () => {
        cancelAnimationFrame(animationId);
      };
    };

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    };

    // Initialize the scene
    initialize();

    // Cleanup function
    return () => {
      if (rendererRef.current && rendererRef.current.domElement && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [modelPath]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    />
  );
};

export default AnimatedCharacter;