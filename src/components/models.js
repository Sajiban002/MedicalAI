import React, { useState, Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';

const AnimatedCharacter = ({ modelPath }) => {
  const meshRef = useRef();
  const mixer = useRef();
  const [model, setModel] = useState();

  // Загружаем модель
  const gltf = useLoader(GLTFLoader, modelPath);

  useEffect(() => {
    if (gltf) {
      // Клонируем сцену для избежания конфликтов
      const clonedScene = gltf.scene.clone();
      
      // Создаём микшер анимации
      const newMixer = new THREE.AnimationMixer(clonedScene);
      
      // Если модель содержит анимации, воспроизводим первую
      if (gltf.animations && gltf.animations.length > 0) {
        const animationAction = newMixer.clipAction(gltf.animations[0]);
        animationAction.play();
      }
      
      mixer.current = newMixer;
      setModel(clonedScene);
    }
  }, [gltf]);

  // Обновляем анимацию каждый кадр
  useFrame((state, delta) => {
    if (mixer.current) {
      mixer.current.update(delta);
    }
    
    // Добавляем красивое вращение модели
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5; // Медленное вращение вокруг оси Y
      
      // Добавляем небольшое покачивание вверх-вниз
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
      
      // Легкое наклонение вперед-назад
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    }
  });

  return (
    <group ref={meshRef}>
      {model && <primitive object={model} scale={[0.1, 0.1, 0.1]} />}
    </group>
  );
};

const Scene = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#b0c4de" />
      <spotLight position={[0, 5, 0]} intensity={0.5} castShadow penumbra={1} />
      
      <Suspense fallback={null}>
        <AnimatedCharacter modelPath="/dmodels/medicine_chest.glb" />
      </Suspense>
      
      <OrbitControls 
        enableZoom={true} 
        enablePan={true}
        minDistance={1}
        maxDistance={10}
        dampingFactor={0.1}
        rotateSpeed={0.5}
      />
      
      {/* Добавляем красивую подсветку */}
      <fog attach="fog" args={['#202030', 5, 20]} />
      
      {/* Добавляем пол с отражением */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial 
          color="#444466" 
          metalness={0.5} 
          roughness={0.4} 
        />
      </mesh>
    </>
  );
};

const App = () => {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas 
        shadows
        camera={{ position: [0, 1, 3], fov: 50 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
};

export default App;