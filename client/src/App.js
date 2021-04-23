import React, { useState } from 'react';
import { BrowserRouter, Switch, Route } from 'react-router-dom';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { CssBaseline } from '@material-ui/core';
import Navbar from './components/Navbar';
import Footer from './components/Footer'
import Home from './routes/Home';
import Friends from './routes/Friends';
import PlacedBets from './routes/PlacedBets';
import OurStory from './routes/OurStory';



function App() {
  let theme = localStorage.getItem('theme')
  if (!theme) {
    localStorage.setItem('theme', 'light')
    theme = 'light'
  }
  const lightTheme = createMuiTheme({
    palette: {
      type: 'light'
    },
  })
  const darkTheme = createMuiTheme({
    palette: {
      type: 'dark'
    },
  })


  const [themeState, setTheme] = useState(theme === 'dark' ? darkTheme : lightTheme);

  const toggleDarkMode = () => {
    const theme = localStorage.getItem('theme')
    if (theme === 'light') {
      setTheme(darkTheme)
      localStorage.setItem('theme', 'dark')
    } else {
      setTheme(lightTheme)
      localStorage.setItem('theme', 'light')

    }
  }

  return (
    <div className='mainBody'>
      <BrowserRouter>
          <ThemeProvider theme={themeState}>
            <CssBaseline />
            <Navbar toggleDarkMode={toggleDarkMode} />
            <Switch>
              <Route exact path='/' component={Home} />
              {/* <Route path='/myclass/:id' render={(props) => <MyClasses {...props} />} />
            <Route path='/exams/:examCode'render={props=><Exam {...props}/>}/> */}
              <Route exact path='/friends' component={Friends} />
              <Route exact path='/bets' component={PlacedBets} />
              <Route path='/ourstory' component={OurStory} />
              <Route component={Home} />
            </Switch>
            <Footer />
          </ThemeProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
