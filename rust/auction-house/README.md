# Auction House

The auction house program allows for any wallet to run a Metaplex NFT secondary marketplace and sellers to list their NFTs with registered auction houses. Sellers are not required to transfer their NFT into an escrow account managed by the marketplace and maintain custody of the NFT up until the sale.

Auction houses receive a seller fee as a percentage of the sale. The seller fee is stored on the auction house account and applies to all sales brokered by the auction house. The selling of the NFT will reduct the auction house seller fee and the royalty payout set on the NFT. The auction house seller funds are sent to a treasury and royalties paid to the co-creators based on the split set on the NFT. The remainder of the proceeds are sent to the seller's wallet.

Collectors looking to purchase an NFT listed with an auction house can make offers. Each offer results in a program derived address (PDA) that stores the offer amount in escrow until the auction house fulfills the sale order or the collector cancels their order by draining the funds from the escrow account.

When an owner of an NFT lists with an auction house they set the floor price but the auction house may gather additional buyers and execute the sale at a higher price. There is no price discovery engine (such as an auction) in place so its on the auction house to facilitate offers on the NFT outside of the program.

An auction house may run in "can change sale price" mode which gives it full rights to set the price on the NFT.

Auction houses can be used to buy and sell any SPL token not just Metaplex NFTs.

## Accounts

### Auction House

seed - ["auction_house", "<authority_address>", "<treasury_mint_address>"]

A Solana account that represents the secondary marketplace. Some key fields tracked by the account include:

- Creator - The wallet that created the auction house.
- Treasury Withdraw Destination - The wallet that receives seller funds for the auction house.
- Fee Withdraw Destination - A wallet that can be used to pay for Solana fees on behalf of the seller.
- Authority - The wallet with permission to update the auction house and process sales.
- Seller Fee Basis Points - The share of the sale the auction house takes on all NFTs.
- Requires Sign Off - The auction house must sign all sale orders.
- Can Change Sale Price - The auction house is 

## Actions

The set of available actions supported by the program with a short description on it's purpose and accounts required to execute the instruction.

_Create Auction House_

_Withdraw_

_Deposit_

_Cancel_

_Sell_

_Buy_

_Execute Sale_

_Withdraw from Fee_

_Widthraw from Treasury_

_Update Auction House_

## Examples

_Creating an Auction House_

_Listing a NFT with an Auction House_

_Buying a NFT from an Auction House_

_Fulfilling a NFT Sale_