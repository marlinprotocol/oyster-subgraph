// Import event classes
import {
    JobOpened,
    JobSettled,
    JobClosed,
    JobDeposited,
    JobWithdrew,
    JobReviseRateInitiated,
    JobReviseRateCancelled,
    JobReviseRateFinalized,
    ProviderAdded,
    ProviderRemoved,
    ProviderUpdatedWithCp
} from "../generated/implementation/implementation";

import { bigInt, BigInt } from "@graphprotocol/graph-ts/common/numbers";
// Import entity class
import { Job, SettlementHistory, Provider, ReviseRateRequest } from "../generated/schema";
import { log, store } from "@graphprotocol/graph-ts";

// Job event handlers

export function handleJobOpened(event: JobOpened): void {
    const id = event.params.job.toHex();
    let job = Job.load(id);

    if(!job) {
        job = new Job(id);
    }

    job.live = true;
    job.metadata = event.params.metadata;
    job.owner = event.params.owner;
    job.provider = event.params.provider;
    job.rate = event.params.rate;
    job.balance = event.params.balance;
    job.lastSettled = event.params.timestamp;
    job.amountPaid = BigInt.zero();
    job.createdAt = event.params.timestamp;

    job.save();
}

export function handleJobDeposited(event: JobDeposited): void {
    const id = event.params.job.toHex();
    let job = Job.load(id);

    if (!job) {
        log.error("Deposited for non existent job id {}", [id]);
        return;
    }
    job.balance = job.balance.plus(event.params.amount);
    job.save();
}

export function handleJobClosed(event: JobClosed): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        log.error("Closed non existent job with id {}", [id]);
        return;
    } else {
        store.remove("Job", id);
    }
}

export function handleJobRevisedRateInitiated(event: JobReviseRateInitiated): void {
    const id = event.params.job.toHex();
    let request = ReviseRateRequest.load(id);

    if(!request) {
        request = new ReviseRateRequest(id);
    }

    request.jobId = event.params.job;
    request.value = event.params.newRate;
    request.save();
}

export function handleJobRevisedRateCancelled(event: JobReviseRateCancelled): void {
    store.remove("ReviseRateRequest", event.params.job.toHex());
}

export function handleJobRevisedRateFinalized(event: JobReviseRateFinalized): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    store.remove("ReviseRateRequest", event.params.job.toHex());

    if (!job) {
        return
    }
    
    job.rate = event.params.newRate;
    job.save();
}

export function handleJobSettled(event: JobSettled): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    }
    const amount = event.params.amount;
    if (amount.gt(job.balance)) {
        log.error("Job Settled for amount {} while balance is {}", [amount.toString(), job.balance.toString()]);
        job.balance = BigInt.zero();
    } else {
        job.balance = job.balance.minus(amount);
    } 
    
    job.lastSettled = event.block.timestamp;
    job.save();

    let settlementId = id + event.block.timestamp.toString();
    let settlement = SettlementHistory.load(settlementId);

    if(settlement) {
        return;
    }

    settlement = new SettlementHistory(settlementId);
    settlement.job = id;
    settlement.ts = event.block.timestamp;
    settlement.amount = amount;
    settlement.save();
}

export function handleJobWithdrew(event: JobWithdrew): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    } else {
        const amount = event.params.amount;
        if (amount.gt(job.balance)) {
            job.balance = BigInt.zero();
        } else {
            job.balance = job.balance.minus(amount);
        }  
        job.save();      
    } 
}

//provider event handlers

export function handleProviderAdded(event: ProviderAdded): void {
    const id = event.params.provider.toHex();
    const provider = new Provider(id);

    provider.cp = event.params.cp;
    provider.live = true;
    provider.save();
}

export function handleProviderRemoved(event: ProviderRemoved): void {
    const id = event.params.provider.toHex();
    const provider = Provider.load(id);

    if (!provider) {
        return
    } else {
        store.remove("Provider", id);
    }
}

export function handleProviderUpdatedWithCp(event: ProviderUpdatedWithCp): void {
    const id = event.params.provider.toHex();
    const provider = Provider.load(id);

    if (!provider) {
        return
    } else {
        provider.cp = event.params.newCp;
        provider.save();
    }
}