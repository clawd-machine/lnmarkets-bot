#!/usr/bin/env node

import { LNMClient } from './lib/lnm-client.js'
import config from './config.js'
import readline from 'readline'

const client = new LNMClient(config)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('Connecting to LNMarkets...')
  try {
    const health = await client.healthCheck()
    if (!health.ok) {
      console.error('Failed to connect:', health.error)
      process.exit(1)
    }
    console.log(`Connected! Balance: ${health.balance} sats\n`)

    while (true) {
      await showMenu()
    }

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

async function showMenu() {
  const positions = await client.getPositions()
  
  if (positions.length === 0) {
    console.log('No open positions.')
  } else {
    console.log('--- OPEN POSITIONS ---')
    console.log('#   | ID                                   | Side | Qty ($) | Entry ($) | PnL (sats) | Fees (sats)')
    console.log('-'.repeat(96))
    positions.forEach((p, i) => {
      const side = p.side === 'b' ? 'LONG ' : 'SHORT'
      const pnlSign = p.pnl >= 0 ? '+' : ''
      const fees = Math.abs(p.sumCarryFees || 0) // fees are usually negative sum_carry_fees
      const index = (i + 1).toString().padEnd(3)
      console.log(`[${index}] ${p.id} | ${side} | ${p.quantity.toString().padEnd(7)} | ${p.entryPrice.toFixed(0).padEnd(9)} | ${pnlSign}${p.pnl.toString().padEnd(10)} | -${fees}`)
    })
    console.log('-'.repeat(96))
  }

  return new Promise((resolve) => {
    rl.question('\nOptions:\n  [#] View/Close position by number (e.g. 1)\n  [R] Refresh\n  [Q] Quit\n> ', async (answer) => {
      const input = answer.trim()
      
      if (input.toLowerCase() === 'q') {
        rl.close()
        process.exit(0)
      }
      
      if (input.toLowerCase() === 'r') {
        resolve()
        return
      }

      let selectedPos = null;
      
      // Check if input is a number
      const num = parseInt(input);
      if (!isNaN(num) && num > 0 && num <= positions.length) {
        selectedPos = positions[num - 1];
      } else {
        // Fallback: Check if input is a valid position ID
        selectedPos = positions.find(p => p.id === input)
      }

      if (selectedPos) {
        await managePosition(selectedPos)
      } else {
        console.log('Invalid option, number, or ID.')
      }
      resolve()
    })
  })
}

async function managePosition(pos) {
  console.log(`\n--- POSITION DETAILS: ${pos.id} ---`)
  console.log(`Side:         ${pos.side === 'b' ? 'LONG' : 'SHORT'}`)
  console.log(`Quantity:     $${pos.quantity}`)
  console.log(`Entry Price:  $${pos.entryPrice}`)
  console.log(`Liquidation:  $${pos.liquidationPrice}`)
  console.log(`Leverage:     ${pos.leverage}x`)
  console.log(`Margin:       ${pos.margin} sats`)
  console.log(`Unrealized PnL: ${pos.pnl} sats`)
  console.log(`Carry Fees:   ${pos.sumCarryFees} sats`) // Negative = paid
  console.log(`Opening Fee:  ${pos.openingFee} sats`)
  
  // Format running time if valid
  let runningTimeStr = 'Unknown';
  if (pos.runningTime) {
      try {
          runningTimeStr = new Date(pos.runningTime).toLocaleString();
      } catch (e) {
          runningTimeStr = pos.runningTime;
      }
  }
  console.log(`Running Since:${runningTimeStr}`)

  return new Promise((resolve) => {
    rl.question('\nActions:\n  [C] Close Position\n  [B] Back\n> ', async (answer) => {
      if (answer.toLowerCase() === 'c') {
        process.stdout.write('Closing position... ')
        try {
          const result = await client.closePosition(pos.id)
          console.log(`Done! Closed at $${result.exitPrice}. PnL: ${result.pnl} sats.`)
        } catch (err) {
          console.log(`Failed: ${err.message}`)
        }
      }
      resolve()
    })
  })
}

main()
