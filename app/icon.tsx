import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#bef264',
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: '#070a00',
          letterSpacing: '-0.5px',
        }}
      >
        MT
      </div>
    ),
    { ...size }
  )
}
