import React from 'react';
import { motion } from 'motion/react';

interface ThreeDBarProps {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    label?: string;
    value?: number;
    count?: number;
    percentage?: string;
    delay?: number;
    onClick?: () => void;
}

export const ThreeDBar: React.FC<ThreeDBarProps> = ({ 
    x, y, width, height, color, label, value, count, percentage, delay = 0, onClick 
}) => {
    // Definimos los puntos para el efecto isométrico/3D
    // Cara Frontal: Rectángulo principal
    // Cara Superior: Trapecio inclinado
    // Cara Lateral: Cara derecha con sombra
    
    const depth = width * 0.4;
    const tilt = 15; // Ángulo de inclinación

    return (
        <motion.g
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.8, delay, ease: "easeOut" }}
            style={{ originY: `${y + height}px`, cursor: onClick ? 'pointer' : 'default' }}
            onClick={onClick}
            className="group"
        >
            {/* Sombra proyectada en el "suelo" */}
            <ellipse 
                cx={x + width / 2} 
                cy={y + height} 
                rx={width * 0.8} 
                ry={depth * 0.3} 
                fill="black" 
                fillOpacity="0.05"
                className="blur-sm"
            />

            {/* Cara Lateral (Derecha) - Sombra más oscura */}
            <path
                d={`
                    M ${x + width} ${y}
                    L ${x + width + depth} ${y - tilt}
                    L ${x + width + depth} ${y + height - tilt}
                    L ${x + width} ${y + height}
                    Z
                `}
                fill={color}
                filter="brightness(0.7)"
            />

            {/* Cara Superior - Brillo máximo */}
            <path
                d={`
                    M ${x} ${y}
                    L ${x + depth} ${y - tilt}
                    L ${x + width + depth} ${y - tilt}
                    L ${x + width} ${y}
                    Z
                `}
                fill={color}
                filter="brightness(1.2)"
            />

            {/* Cara Frontal - Color base */}
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color}
            />

            {/* Overlay de brillo al hover */}
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill="white"
                className="opacity-0 group-hover:opacity-10 transition-opacity"
            />

            {/* Etiqueta de valor y porcentaje (Doble línea centrada) */}
            {value !== undefined && (
                <g className="pointer-events-none drop-shadow-sm">
                    <text
                        x={x + width / 2}
                        y={y - 45}
                        textAnchor="middle"
                        className="text-[16px] font-black fill-foreground/90"
                    >
                        S/ {Math.round(value).toLocaleString()}
                    </text>
                    
                    <text
                        x={x + width / 2}
                        y={y - 25}
                        textAnchor="middle"
                        className="text-[14px] font-black fill-foreground/80"
                    >
                        {count !== undefined && `${count} Reg.`}
                        {percentage && ` • ${percentage}%`}
                    </text>
                </g>
            )}
        </motion.g>
    );
};
