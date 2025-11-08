"use client"

import React from 'react'
import NavBar from "@/framer/navigation/nav-bar"
import Footer from "@/framer/navigation/footer"

export default function Layout({ 
  children, 
  style 
}: { 
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div>
      <div style={{ position: "relative", zIndex: 10 }}>
        <NavBar.Responsive style={{ width: '100%'}} />
      </div>
      <div style={style}>
        {children}
      </div>
      <div style={{ position: "relative", zIndex: 10 }}>
        <Footer.Responsive style={{ width: '100%'}} />
      </div>
    </div>
  )
}