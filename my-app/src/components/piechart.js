import React, { useState, useEffect } from 'react';
import { FaChartPie } from 'react-icons/fa';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

const DiagnosisPieChart = ({ diagnoses }) => {
  const [animationActive, setAnimationActive] = useState(true);
  const [activeIndex, setActiveIndex] = useState(null);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#EC7063', '#5D6D7E', '#45B39D'];
  
  const normalizedData = React.useMemo(() => {
    if (!diagnoses || diagnoses.length === 0) return [];
    
    return diagnoses.map(item => ({
      name: (item.name || "Неизвестный диагноз").replace(/[.,!?]$/, '').trim(),
      probability: item.probability || 0,
    }));
  }, [diagnoses]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimationActive(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  if (!normalizedData || normalizedData.length === 0) {
    return (
      <div className="no-diagnoses">
        <p>Недостаточно данных для прогноза вероятных заболеваний</p>
      </div>
    );
  }

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, value }) => {
    if (percent < 0.1) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
      >
        {`${value}%`}
      </text>
    );
  };

  const renderLegend = (props) => {
    const { payload } = props;
    
    return (
      <ul className="recharts-default-legend" style={{ padding: 0, margin: 0, listStyle: 'none' }}>
        {payload.map((entry, index) => {
          const diagnosisItem = normalizedData[index] || { name: "Неизвестно", probability: 0 };
          
          return (
            <li 
              key={`item-${index}`} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                padding: '4px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                backgroundColor: activeIndex === index ? '#f0f7ff' : 'transparent'
              }}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div style={{
                width: 10,
                height: 10,
                backgroundColor: entry.color,
                marginRight: 8,
                borderRadius: '50%',
                transition: 'transform 0.2s ease',
                transform: activeIndex === index ? 'scale(1.3)' : 'scale(1)'
              }} />
              <span style={{ 
                fontSize: '0.9rem', 
                color: activeIndex === index ? '#333' : '#555',
                fontWeight: activeIndex === index ? '500' : 'normal',
                transition: 'all 0.2s ease'
              }}>
                {diagnosisItem.name.length > 30 ? diagnosisItem.name.substring(0, 30) + '...' : diagnosisItem.name}: {diagnosisItem.probability}%
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="diagnosis-chart-container">
      <h3 className="chart-title">
        <FaChartPie className="chart-icon" />
        Вероятность диагнозов
      </h3>
      <div style={{ width: '100%', height: 300, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <defs>
              {COLORS.map((color, index) => (
                <filter
                  key={`shadow-${index}`}
                  id={`shadow-${index}`}
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow 
                    dx="0" 
                    dy="0" 
                    stdDeviation={activeIndex === index ? "4" : "0"}
                    floodColor={color}
                    floodOpacity="0.3"
                  />
                </filter>
              ))}
            </defs>
            <Pie
              data={normalizedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={90}
              innerRadius={50}
              fill="#8884d8"
              dataKey="probability"
              nameKey="name"
              isAnimationActive={animationActive}
              animationDuration={1500}
              animationBegin={0}
            >
              {normalizedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]} 
                  style={{
                    filter: activeIndex === index ? `url(#shadow-${index})` : 'none',
                    opacity: activeIndex === null || activeIndex === index ? 1 : 0.8,
                    transition: 'opacity 0.3s ease',
                  }}
                />
              ))}
            </Pie>
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              content={renderLegend}
              wrapperStyle={{ right: 0, maxWidth: '40%' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <style jsx>{`
        .diagnosis-chart-container {
          background: white;
          border-radius: 8px;
          padding: 1.25rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .chart-title {
          display: flex;
          alignItems: center;
          gap: 0.75rem;
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.2rem;
          color: #333;
          fontWeight: 600;
        }
        
        .chart-icon {
          color: #2c73d2;
        }
      `}</style>
    </div>
  );
};

export default DiagnosisPieChart;