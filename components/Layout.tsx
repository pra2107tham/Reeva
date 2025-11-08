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
      <NavBar.Responsive style={{ width: '100%'}} />
      <div style={style}>
        {children}
      </div>
      <Footer.Responsive style={{ width: '100%'}} />
    </div>
  )
}