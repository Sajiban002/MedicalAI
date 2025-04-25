import React, { useState } from 'react';
import '../css/AboutUs.css';
import image1 from '../images/docwoman.JPG';
import image2 from '../images/docwoman.JPG';
import image3 from '../images/docwoman.JPG';
import image4 from '../images/docwoman.JPG';

const data = [
  { img: image1, label: 'Lorem ipsum', title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' },
  { img: image2, label: 'Lorem ipsum', title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' },
  { img: image3, label: 'Lorem ipsum', title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' },
  { img: image4, label: 'Lorem ipsum', title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' }
];

const Slider = () => {
  const [activeId, setActiveId] = useState(0);

  const handleClick = (e) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;

    if (x < width / 2 && activeId > 0) {
      setActiveId((prevId) => prevId - 1);
    } else if (x >= width / 2 && activeId < data.length - 1) {
      setActiveId((prevId) => prevId + 1);
    }
  };

  return (
    <div className="slider-fone">
      <div className="slider-wrap" onClick={handleClick}>
        <div className="slider">
          {data.map((slide, idx) => (
            <div
              key={idx}
              className={`slide${idx === activeId ? ' active' : ''}`}
            >
              <div className="slide__info">
                <div className="slide__label">{slide.label}</div>
                <div className="slide__title">{slide.title}</div>
              </div>
              <img src={slide.img} alt={`Slide ${idx + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Slider;
