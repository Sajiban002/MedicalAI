// import React, { useEffect, useRef, useState } from "react";
// import '../css/AboutUs.css';
// import img1 from "../images/img1.jpg";
// import img2 from "../images/img2.jpg";
// import img3 from "../images/img3.jpg";
// import img4 from "../images/img4.jpg";

// const slides = [
//   {
//     title: "Современные\nтехнологии",
//     text: "Мы применяем самые современные методики и технологии, включая безоперационные процедуры и лабораторную диагностику нового поколения.",
//     img: img1,
//   },
//   {
//     title: "Надёжные\nпрепараты",
//     text: "Все препараты сертифицированы и безопасны. Мы используем только оригинальные средства премиум-класса.",
//     img: img2,
//   },
//   {
//     title: "Высокий\nпрофессионализм",
//     text: "В нашей команде только опытные специалисты с медицинским образованием и высокой квалификацией.",
//     img: img3,
//   },
//   {
//     title: "Индивидуальный\nподход",
//     text: "Мы подбираем лечение с учётом особенностей каждого пациента и его истории.",
//     img: img4,
//   },
// ];

// function ScrollSection() {
//   const [currentTitle, setCurrentTitle] = useState(slides[0].title);
//   const blockRefs = useRef([]);

//   useEffect(() => {
//     const observer = new IntersectionObserver(
//       (entries) => {
//         const visibleEntry = entries.find((entry) => entry.isIntersecting);
//         if (visibleEntry) {
//           const index = Number(visibleEntry.target.dataset.index);
//           setCurrentTitle(slides[index].title);
//         }
//       },
//       { threshold: 0.6 }
//     );

//     blockRefs.current.forEach((ref) => {
//       if (ref) observer.observe(ref);
//     });

//     return () => {
//       if (blockRefs.current)
//         blockRefs.current.forEach((ref) => {
//           if (ref) observer.unobserve(ref);
//         });
//     };
//   }, []);

//   return (
//     <div className="scroll-section-container">
//       <div className="scroll-section-left">
//         <h2 className="scroll-section-title">
//           {currentTitle.split("\n").map((line, i) => (
//             <span key={i}>
//               {line}
//               <br />
//             </span>
//           ))}
//         </h2>
//       </div>

//       <div className="scroll-section-right">
//         {slides.map((slide, index) => (
//           <div
//             className="scroll-section-block"
//             key={index}
//             ref={(el) => (blockRefs.current[index] = el)}
//             data-index={index}
//           >
//             <img src={slide.img} alt="slide" className="scroll-section-img" />
//             <p className="scroll-section-text">{slide.text}</p>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// export default ScrollSection;
import React, { useEffect, useRef, useState } from "react";
import "../css/AboutUs.css";
import img1 from "../images/img1.jpg";
import img2 from "../images/img2.jpg";
import img3 from "../images/img3.jpg";
import img4 from "../images/img4.jpg";

const slides = [
  {
    title: "Современные\nтехнологии",
    text: "Мы применяем самые современные методики и технологии, включая безоперационные процедуры и лабораторную диагностику нового поколения.",
    img: img1,
  },
  {
    title: "Надёжные\nпрепараты",
    text: "Все препараты сертифицированы и безопасны. Мы используем только оригинальные средства премиум-класса.",
    img: img2,
  },
  {
    title: "Высокий\nпрофессионализм",
    text: "В нашей команде только опытные специалисты с медицинским образованием и высокой квалификацией.",
    img: img3,
  },
  {
    title: "Индивидуальный\nподход",
    text: "Мы подбираем лечение с учётом особенностей каждого пациента и его истории.",
    img: img4,
  },
];

function ScrollSection() {
  const [currentTitleIndex, setCurrentTitleIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [visible, setVisible] = useState(true);
  const blockRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((entry) => entry.isIntersecting);
        if (entry && !isAnimating) {
          const index = Number(entry.target.dataset.index);
          if (index !== currentTitleIndex) {
            setIsAnimating(true);
            setVisible(false); // прячем заголовок

            setTimeout(() => {
              setCurrentTitleIndex(index); // меняем текст
              setVisible(true); // показываем заголовок
            }, 500);

            setTimeout(() => {
              setIsAnimating(false);
            }, 1000);
          }
        }
      },
      {
        threshold: 0.7, // заголовок сменится чуть позже
        rootMargin: "-20% 0px -20% 0px",
      }
    );

    blockRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      blockRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, [currentTitleIndex, isAnimating]);

  return (
    <div className="scroll-section-container">
      <div className="scroll-section-left">
        <h2 className={`scroll-section-title ${visible ? "visible" : "hidden"}`}>
          {slides[currentTitleIndex].title.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))}
        </h2>
      </div>

      <div className="scroll-section-right">
        {slides.map((slide, index) => (
          <div
            className="scroll-section-block"
            key={index}
            ref={(el) => (blockRefs.current[index] = el)}
            data-index={index}
          >
            <img src={slide.img} alt="slide" className="scroll-section-img" />
            <p className="scroll-section-text">{slide.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ScrollSection;
