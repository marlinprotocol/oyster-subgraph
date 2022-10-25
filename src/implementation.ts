// Import event classes
import {
    JobOpened,
    JobSettled,
    JobClosed,
    JobDeposited,
    JobWithdrew,
    JobRevisedRate,
    ProviderAdded,
    ProviderRemoved,
    ProviderUpdatedWithCp
} from "../generated/implementation/implementation";

import { bigInt, BigInt } from "@graphprotocol/graph-ts/common/numbers";
// Import entity class
import { Job, Provider } from "../generated/schema";

// Job event handlers

export function handleJobOpened(event: JobOpened): void {
    const id = event.params.job.toHex();
    const job = new Job(id);

    job.metadata = event.params.metadata;
    job.owner = event.params.owner;
    job.provider = event.params.provider;
    job.rate = event.params.rate;
    job.balance = event.params.balance;
    job.lastSettled = event.params.timestamp;
    job.live = true;

    job.save();
}

export function handleJobDeposited(event: JobDeposited): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    } else {
        if (job.balance) {
            
            job.balance = bigInt.plus(job.balance!, event.params.amount);
        }
    }
}

export function handleJobClosed(event: JobClosed): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    } else {
        job.metadata = null;
        job.owner = null;
        job.provider = null;
        job.lastSettled = null;
        job.rate = null;
        job.balance = null;
        job.live = false;
    }
}

export function handleJobRevisedRate(event: JobRevisedRate): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    } else {
        job.rate = event.params.newRate;
    }
}

export function handleJobSettled(event: JobSettled): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    } else {
        const amount = event.params.amount;
        if (!job.balance) {
            job.balance = BigInt.zero();
        } else {
            if (amount.gt(job.balance!)) {
                job.balance = BigInt.zero();
            } else {
                job.balance = job.balance!.minus(amount);
            }
        } 
        
        job.lastSettled = event.block.timestamp;        
    } 
}

export function handleJobWithdrew(event: JobWithdrew): void {
    const id = event.params.job.toHex();
    const job = Job.load(id);

    if (!job) {
        return
    } else {
        const amount = event.params.amount;
        if (!job.balance) {
            job.balance = BigInt.zero();
        } else {
            if (amount.gt(job.balance!)) {
                job.balance = BigInt.zero();
            } else {
                job.balance = job.balance!.minus(amount);
            }
        }        
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
        provider.cp = null;
        provider.live = false;
    }
}

export function handleProviderUpdatedWithCp(event: ProviderUpdatedWithCp): void {
    const id = event.params.provider.toHex();
    const provider = Provider.load(id);

    if (!provider) {
        return
    } else {
        provider.cp = event.params.newCp;
    }
}