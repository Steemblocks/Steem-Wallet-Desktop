# Complete verification for steemchiller matching SteemWorld
Write-Host "=== steemchiller Verification ==="

# Get account data
$r = Invoke-RestMethod -Uri "https://api.steemit.com" -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"database_api.find_accounts","params":{"accounts":["steemchiller"]},"id":1}'
$a = $r.result.accounts[0]

# Calculate effective vests (with power down subtracted)
$vestRaw = [decimal]$a.vesting_shares.amount
$recRaw = [decimal]$a.received_vesting_shares.amount
$delRaw = [decimal]$a.delegated_vesting_shares.amount
$withdrawRate = [decimal]$a.vesting_withdraw_rate.amount
$effectiveRaw = $vestRaw + $recRaw - $delRaw - $withdrawRate
$effectiveVests = $effectiveRaw / 1e6

Write-Host "Effective Vests: $([math]::Round($effectiveVests, 2)) VESTS"

# Get global properties for SP conversion
$dgp = Invoke-RestMethod -Uri "https://api.steemit.com" -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"condenser_api.get_dynamic_global_properties","params":[],"id":1}'
$totalVestingFund = [decimal]($dgp.result.total_vesting_fund_steem -replace ' STEEM','')
$totalVestingShares = [decimal]($dgp.result.total_vesting_shares -replace ' VESTS','')
$steemPerVest = $totalVestingFund / $totalVestingShares
$effectiveSP = $effectiveVests * $steemPerVest
Write-Host "Effective SP: $([math]::Round($effectiveSP, 2)) (SteemWorld: 821,850.73)"

# Voting Power
$mana = [decimal]$a.voting_manabar.current_mana
$lastUpdate = [long]$a.voting_manabar.last_update_time
$now = [long](Get-Date -UFormat %s)
$secSince = $now - $lastUpdate
$regenMana = ($effectiveRaw / 432000) * $secSince
$currentMana = [Math]::Min($mana + $regenMana, $effectiveRaw)
$vp = ($currentMana / $effectiveRaw) * 100
Write-Host "Voting Power: $([math]::Round($vp, 2))% (SteemWorld: ~89-90%)"

# RC
$rc = Invoke-RestMethod -Uri "https://api.steemit.com" -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"rc_api.find_rc_accounts","params":{"accounts":["steemchiller"]},"id":1}'
$rcAcc = $rc.result.rc_accounts[0]
$maxRc = [decimal]$rcAcc.max_rc
$rcMana = [decimal]$rcAcc.rc_manabar.current_mana
$rcLastUpdate = [long]$rcAcc.rc_manabar.last_update_time
$rcSecSince = $now - $rcLastUpdate
$rcRegen = ($maxRc / 432000) * $rcSecSince
$currentRc = [Math]::Min($rcMana + $rcRegen, $maxRc)
$rcPct = ($currentRc / $maxRc) * 100
Write-Host "RC: $([math]::Round($rcPct, 2))% (SteemWorld: 81.03%)"

# Vote Value
$rf = Invoke-RestMethod -Uri "https://api.steemit.com" -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"condenser_api.get_reward_fund","params":["post"],"id":1}'
$rewardBalance = [decimal]($rf.result.reward_balance -replace ' STEEM','')
$recentClaims = [decimal]$rf.result.recent_claims

$price = Invoke-RestMethod -Uri "https://api.steemit.com" -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"condenser_api.get_current_median_history_price","params":[],"id":1}'
$base = [decimal]($price.result.base -replace ' SBD','')
$quote = [decimal]($price.result.quote -replace ' STEEM','')
$sbdPerSteem = $base / $quote

$finalVest = $effectiveVests * 1e6

# Current vote value - Fixed formula
$vpScale = $vp * 100  # 0-10000 scale
$weight = 10000  # 100%
$currentPower = ($vpScale * $weight / 10000) / 50
$currentRshares = $currentPower * $finalVest / 10000
$currentVoteSteem = $currentRshares / $recentClaims * $rewardBalance
$currentVoteSbd = $currentVoteSteem * $sbdPerSteem
Write-Host "Current Vote Value: `$$([math]::Round($currentVoteSbd, 2)) (SteemWorld: `$4.69)"

# Full vote value
$fullVpScale = 10000  # 100%
$fullPower = ($fullVpScale * $weight / 10000) / 50
$fullRshares = $fullPower * $finalVest / 10000
$fullVoteSteem = $fullRshares / $recentClaims * $rewardBalance
$fullVoteSbd = $fullVoteSteem * $sbdPerSteem
Write-Host "Full Vote Value: `$$([math]::Round($fullVoteSbd, 2)) (SteemWorld: `$5.24)"
