const Match = require('../models/match')
const ServerVars = require('../models/server_variables')
const User = require('../models/user')
const Challenge = require('../models/challenge')
const { env, dev, production } = require('../config/keys')
var request = require("request");

const footballApiKey = env === 'dev' ? dev.apiFootballKey : production.apiFootballKey

module.exports.fetchMatchFixtures = () => {
  fetchData()
  setTimers()
  setInterval(() => {
    fetchData()
  }, 60 * 60 * 24 * 1000)
}

fetchData = async () => {
  console.log('FetchData Invoked!')
  let d = new Date()
  d.setTime(d.getTime() + 60 * 60 * 24 * 1000)
  let nowYear = d.getFullYear()
  let nowMonth = d.getMonth() + 1
  nowMonth = nowMonth < 10 ? '0' + nowMonth : nowMonth
  let nowDay = d.getDate()
  nowDay = nowDay < 10 ? '0' + nowDay : nowDay
  let nowDate = nowYear + '-' + nowMonth + '-' + nowDay
  var options = {
    method: 'GET',
    url: 'https://v3.football.api-sports.io/fixtures',
    qs: { date: nowDate},
    headers: {
      'x-rapidapi-host': 'v3.football.api-sports.io',
      'x-rapidapi-key': footballApiKey
    }
  };
  try {
    const serverResponse = await ServerVars.findOne({})
    if (serverResponse !== null) {
      const lastFetchTimestamp = parseInt(serverResponse.fetchLastTimestamp)
      let lastDate = new Date(lastFetchTimestamp)
      let lastYear = lastDate.getFullYear()
      let lastMonth = lastDate.getMonth() + 1
      lastMonth = lastMonth < 10 ? '0' + lastMonth : lastMonth
      let lastDay = lastDate.getDate()
      lastDay = lastDay < 10 ? '0' + lastDay : lastDay
      let lastFormattedDate = lastYear + '-' + lastMonth + '-' + lastDay
      if (lastFormattedDate === nowDate) {
        console.log('Ignoring Fetch, Data already Fetched!')
        return
      }
    }


    request(options, async (error, response, body) => {
      if (error) {
        console.log(error)
        return
      }
      const result = JSON.parse(body)
      const fixtureDetails = result.response
      console.log(result)
      if (result.errors.length > 0) {
        console.log(result.errors)
        return
      }
      var p = 0
      await Promise.all(fixtureDetails.map(async (res) => {
        const response = await Match.findOne({ matchID: res.fixture.id })
        if (response) return true
        if(res.fixture.status.long!=='Not Started') return true
        if(p>70) return true
        p += 1
        await new Match({
          matchID: res.fixture.id,
          referee: res.fixture.referee,
          timestamp: res.fixture.timestamp * 1000,
          venue: res.fixture.venue.name + ', ' + res.fixture.venue.city,
          league: {
            name: res.league.name,
            country: res.league.country,
            logo: res.league.logo,
            season: res.league.season,
            round: res.league.round
          },
          teamHome: {
            name: res.teams.home.name,
            logo: res.teams.home.logo,
            score: res.goals.home,
          },
          teamAway: {
            name: res.teams.away.name,
            logo: res.teams.away.logo,
            score: res.goals.away,
          },
          winner: res.teams.home.winner ? "home" : res.teams.away.winner ? "away" : "nil",
          status: res.fixture.status.long,
          challenges: []
        }).save()
      }))
      if (serverResponse !== null) {
        serverResponse.set({ fetchLastTimestamp: d.getTime() })
        await serverResponse.save()
      } else {
        await new ServerVars({
          fetchLastTimestamp: d.getTime()
        }).save()
      }
    });
    

  } catch (e) {
    console.log(e)
  }
}

setTimers = async () => {
  console.log('Setting Timers for Ongoing Matches')
  const response = await Match.find({ status: { $ne: "Match Finished" } }, { matchID: 1, timestamp: 1 })
  response.forEach((res) => {
    const id = res.matchID
    const matchTime = res.timestamp
    const d = new Date(matchTime)
    d.setTime(d.getTime() + 1000 * 60 * 60 * 5)
    const fetchTimestamp = d.getTime()
    const curDate = new Date().getTime()
    if(curDate-fetchTimestamp>24*60*60*1000)
      return
    const diff = Math.max(1000, fetchTimestamp - curDate)

    setTimerForMatch(id, diff)
  })
  console.log('Completed Setting timers')
}

setTimerForMatch = (id, diff) => {
  setTimeout(() => {
    var options = {
      method: 'GET',
      url: 'https://v3.football.api-sports.io/fixtures',
      qs: { id: id },
      headers: {
        'x-rapidapi-host': 'v3.football.api-sports.io',
        'x-rapidapi-key': footballApiKey
      }
    };
    request(options, async (error, response, body) => {
      if (error) {
        console.log(error)
        return
      }
      try {
        const result = JSON.parse(body)
        const fixtureDetails = result.response[0]
        if (result.errors.length > 0) {
          const d = new Date().getTime()
          setTimerForMatch(id, d + 1000 * 60 * 60 * 5)
          return
        }
        const winner = fixtureDetails.teams.home.winner ? 'home' : fixtureDetails.team.home.away ? 'away' : 'nil'
        const matchResponse = await Match.findOne({ matchID: id })
        matchResponse.set({ winner: winner, status: fixtureDetails.fixture.status.long==='Match Finished'?'Match Finished':'Not Decided (Declared as Draw)' })
        await matchResponse.save()
        if (!matchResponse.challenges) return

        const challenges = matchResponse.challenges
        if (winner === 'nil') {
          await Promise.all(challenges.map(async (id) => {

            const challenge = await Challenge.findOne({ _id: id })
            const userID1 = challenge.userID1
            const userID2 = challenge.userID2
            const amount = challenge.betAmount
            challenge.set({ status: fixtureDetails.fixture.status.long==='Match Finished'?'Match Finished':'Not Decided (Declared as Draw)', winner: 'nil' })
            await challenge.save()
            const user1 = await User.findOne({ _id: userID1 })
            user1.set({ rewardCoins: user1.rewardCoins + amount })
            user1.save()
            const user2 = await User.findOne({ _id: userID2 })
            user2.set({ rewardCoins: user2.rewardCoins + amount })
            user2.save()
          }))
        } else if (winner === 'home') {
          await Promise.all(challenges.map(async (id) => {

            const challenge = await Challenge.findOne({ _id: id })
            const userID1 = challenge.userID1
            const amount = challenge.betAmount
            challenge.set({ status: 'Match Finished', winner: 'home' })
            await challenge.save()
            const user1 = await User.findOne({ _id: userID1 })
            user1.set({ rewardCoins: user1.rewardCoins + 2 * amount })
            await user1.save()
            const referredUser = await User.findOne({ referralCode: user1.usedReferralCode })
            referredUser.set({ rewardCoins: referredUser.rewardCoins + Math.trunc(2 * 0.1 * amount) })
            await referredUser.save()
          }))
        } else if (winner === 'away') {
          await Promise.all(challenges.map(async (id) => {
            const challenge = await Challenge.findOne({ _id: id })
            const userID2 = challenge.userID2
            const amount = challenge.betAmount
            challenge.set({ status: 'Match Finished', winner: 'away' })
            await challenge.save()
            const user2 = await User.findOne({ _id: userID2 })
            user2.set({ rewardCoins: user2.rewardCoins + 2 * amount })
            user2.save()
            const referredUser = await User.findOne({ referralCode: user2.usedReferralCode })
            referredUser.set({ rewardCoins: referredUser.rewardCoins + Math.trunc(2 * 0.1 * amount) })
            await referredUser.save()
          }))

        }

      } catch (e) {
        console.log('Error Occured in Fetching the Details')
        const d = new Date().getTime()
        setTimerForMatch(id, d + 1000 * 60 * 60 * 5)
      }
    })
  }, diff)
}

